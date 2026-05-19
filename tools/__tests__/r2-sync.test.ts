import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { mockClient } from "aws-sdk-client-mock";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

import {
  readLedger,
  appendLedgerRow,
  type LedgerRow,
} from "../shared/r2-ledger.ts";
import {
  readDisposition,
  appendDispositionRow,
} from "../shared/r2-disposition.ts";
import { uploadSlug } from "../shared/r2-uploader.ts";

function sha(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

// ---------------------------------------------------------------------------
// ledger round-trip
// ---------------------------------------------------------------------------

test("r2-ledger: append + read round-trip", () => {
  const dir = mkdtempSync(join(tmpdir(), "ledger-"));
  try {
    const path = join(dir, ".ledger.jsonl");
    const row: LedgerRow = {
      slug: "test-slug",
      host: "example.com",
      uploaded_at: "2026-05-19T00:00:00.000Z",
      files: [{ name: "content.md", sha: "abc123", bytes: 100 }],
    };
    appendLedgerRow(row, path);
    const map = readLedger(path);
    assert.equal(map.size, 1);
    assert.deepEqual(map.get("test-slug"), row);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("r2-ledger: last row wins per slug", () => {
  const dir = mkdtempSync(join(tmpdir(), "ledger-"));
  try {
    const path = join(dir, ".ledger.jsonl");
    appendLedgerRow({ slug: "s1", host: "h", uploaded_at: "t1", files: [] }, path);
    appendLedgerRow({ slug: "s1", host: "h", uploaded_at: "t2", files: [] }, path);
    const map = readLedger(path);
    assert.equal(map.get("s1")?.uploaded_at, "t2");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("r2-ledger: partial last line tolerated", () => {
  const dir = mkdtempSync(join(tmpdir(), "ledger-"));
  try {
    const path = join(dir, ".ledger.jsonl");
    writeFileSync(path, '{"slug":"ok","host":"h","uploaded_at":"t","files":[]}\n{"slug":"bad","host":"h"');
    const map = readLedger(path);
    assert.equal(map.size, 1);
    assert.ok(map.has("ok"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// disposition round-trip
// ---------------------------------------------------------------------------

test("r2-disposition: keep overrides prior delete", () => {
  const dir = mkdtempSync(join(tmpdir(), "disp-"));
  try {
    const path = join(dir, ".disp.jsonl");
    appendDispositionRow({
      slug: "s1", host: "h", file: "avatar.png",
      action: "delete", reason: "avatar", decided_at: "t1",
    }, path);
    appendDispositionRow({
      slug: "s1", host: "h", file: "avatar.png",
      action: "keep", reason: "reverted", decided_at: "t2",
    }, path);
    const map = readDisposition(path);
    const key = `s1\x00avatar.png`;
    assert.equal(map.get(key)?.action, "keep");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// uploadSlug decision matrix (mocked S3)
// ---------------------------------------------------------------------------

function setupSlugDir(): { rootDir: string; slugDir: string; cleanup: () => void } {
  const rootDir = mkdtempSync(join(tmpdir(), "r2-sync-"));
  const slugDir = join(rootDir, "raw", "raindrop", "example.com", "test-slug");
  mkdirSync(slugDir, { recursive: true });
  return { rootDir, slugDir, cleanup: () => rmSync(rootDir, { recursive: true, force: true }) };
}

test("uploadSlug: fresh slug uploads all files", async () => {
  const { slugDir, cleanup } = setupSlugDir();
  try {
    writeFileSync(join(slugDir, "content.md"), "hello");
    writeFileSync(join(slugDir, "img.png"), "binary-data");

    const s3 = mockClient(S3Client);
    s3.on(PutObjectCommand).resolves({});

    const result = await uploadSlug(slugDir, "example.com", "test-slug", {
      bucket: "test-bucket",
      client: s3 as unknown as S3Client,
      ledger: new Map(),
      disposition: new Map(),
      ledgerPath: join(slugDir, ".test-ledger.jsonl"),
    });

    assert.equal(result.uploaded.length, 2);
    assert.equal(result.skipped.length, 0);
    assert.equal(result.r2Deletes.length, 0);
    assert.equal(result.errors.length, 0);
    // Verify PUT was called for each file
    const puts = s3.commandCalls(PutObjectCommand);
    assert.equal(puts.length, 2);
  } finally { cleanup(); }
});

test("uploadSlug: in-sync slug skips all PUTs", async () => {
  const { slugDir, cleanup } = setupSlugDir();
  try {
    writeFileSync(join(slugDir, "content.md"), "hello");
    const ledger = new Map<string, LedgerRow>();
    ledger.set("test-slug", {
      slug: "test-slug", host: "example.com", uploaded_at: "prev",
      files: [{ name: "content.md", sha: sha(Buffer.from("hello")), bytes: 5 }],
    });

    const s3 = mockClient(S3Client);
    s3.on(PutObjectCommand).resolves({});

    const result = await uploadSlug(slugDir, "example.com", "test-slug", {
      bucket: "test-bucket",
      client: s3 as unknown as S3Client,
      ledger,
      disposition: new Map(),
      ledgerPath: join(slugDir, ".test-ledger.jsonl"),
    });

    assert.equal(result.uploaded.length, 0);
    assert.equal(result.skipped.length, 1);
    assert.equal(s3.commandCalls(PutObjectCommand).length, 0);
  } finally { cleanup(); }
});

test("uploadSlug: drift uploads only changed file", async () => {
  const { slugDir, cleanup } = setupSlugDir();
  try {
    writeFileSync(join(slugDir, "content.md"), "NEW content");
    writeFileSync(join(slugDir, "stable.txt"), "unchanged");
    const ledger = new Map<string, LedgerRow>();
    ledger.set("test-slug", {
      slug: "test-slug", host: "example.com", uploaded_at: "prev",
      files: [
        { name: "content.md", sha: sha(Buffer.from("OLD content")), bytes: 11 },
        { name: "stable.txt", sha: sha(Buffer.from("unchanged")), bytes: 9 },
      ],
    });

    const s3 = mockClient(S3Client);
    s3.on(PutObjectCommand).resolves({});

    const result = await uploadSlug(slugDir, "example.com", "test-slug", {
      bucket: "test-bucket",
      client: s3 as unknown as S3Client,
      ledger,
      disposition: new Map(),
      ledgerPath: join(slugDir, ".test-ledger.jsonl"),
    });

    assert.equal(result.uploaded.length, 1);
    assert.equal(result.uploaded[0].name, "content.md");
    assert.equal(result.skipped.length, 1);
    assert.equal(s3.commandCalls(PutObjectCommand).length, 1);
  } finally { cleanup(); }
});

test("uploadSlug: absent-local + present-R2 + no disposition → preserve (no DELETE)", async () => {
  const { slugDir, cleanup } = setupSlugDir();
  try {
    // No files written locally — slug dir is empty
    const ledger = new Map<string, LedgerRow>();
    ledger.set("test-slug", {
      slug: "test-slug", host: "example.com", uploaded_at: "prev",
      files: [{ name: "ghost.png", sha: "deadbeef", bytes: 99 }],
    });

    const s3 = mockClient(S3Client);
    s3.on(DeleteObjectCommand).resolves({});

    const result = await uploadSlug(slugDir, "example.com", "test-slug", {
      bucket: "test-bucket",
      client: s3 as unknown as S3Client,
      ledger,
      disposition: new Map(),
      ledgerPath: join(slugDir, ".test-ledger.jsonl"),
    });

    // No upload, no delete — file is preserved on R2
    assert.equal(result.uploaded.length, 0);
    assert.equal(result.r2Deletes.length, 0);
    assert.equal(s3.commandCalls(DeleteObjectCommand).length, 0);
    // Skipped should reflect the preserved file so a future ledger row keeps it
    assert.equal(result.skipped.length, 1);
    assert.equal(result.skipped[0].name, "ghost.png");
  } finally { cleanup(); }
});

test("uploadSlug: disposition=delete → R2 DELETE issued", async () => {
  const { slugDir, cleanup } = setupSlugDir();
  try {
    const disposition = new Map();
    disposition.set("test-slug\x00avatar.png", {
      slug: "test-slug", host: "example.com", file: "avatar.png",
      action: "delete", reason: "avatar", decided_at: "t",
    });
    const ledger = new Map<string, LedgerRow>();
    ledger.set("test-slug", {
      slug: "test-slug", host: "example.com", uploaded_at: "prev",
      files: [{ name: "avatar.png", sha: "abc", bytes: 50 }],
    });

    const s3 = mockClient(S3Client);
    s3.on(DeleteObjectCommand).resolves({});

    const result = await uploadSlug(slugDir, "example.com", "test-slug", {
      bucket: "test-bucket",
      client: s3 as unknown as S3Client,
      ledger,
      disposition,
      ledgerPath: join(slugDir, ".test-ledger.jsonl"),
    });

    assert.equal(result.r2Deletes.length, 1);
    assert.equal(result.r2Deletes[0].name, "avatar.png");
    assert.equal(s3.commandCalls(DeleteObjectCommand).length, 1);
  } finally { cleanup(); }
});

test("uploadSlug: dryRun skips network + ledger writes", async () => {
  const { slugDir, cleanup } = setupSlugDir();
  try {
    writeFileSync(join(slugDir, "content.md"), "hello");

    const s3 = mockClient(S3Client);
    s3.on(PutObjectCommand).resolves({});

    const result = await uploadSlug(slugDir, "example.com", "test-slug", {
      bucket: "test-bucket",
      client: s3 as unknown as S3Client,
      ledger: new Map(),
      disposition: new Map(),
      dryRun: true,
      ledgerPath: join(slugDir, ".test-ledger.jsonl"),
    });

    assert.equal(result.uploaded.length, 1);
    assert.equal(s3.commandCalls(PutObjectCommand).length, 0);
  } finally { cleanup(); }
});

test("uploadSlug: PUT error preserves ledger (no half-applied row)", async () => {
  const { slugDir, cleanup } = setupSlugDir();
  try {
    writeFileSync(join(slugDir, "content.md"), "hello");

    const s3 = mockClient(S3Client);
    s3.on(PutObjectCommand).rejects(new Error("S3 unreachable"));

    const result = await uploadSlug(slugDir, "example.com", "test-slug", {
      bucket: "test-bucket",
      client: s3 as unknown as S3Client,
      ledger: new Map(),
      disposition: new Map(),
      ledgerPath: join(slugDir, ".test-ledger.jsonl"),
    });

    assert.equal(result.errors.length, 1);
    assert.equal(result.uploaded.length, 0);
  } finally { cleanup(); }
});
