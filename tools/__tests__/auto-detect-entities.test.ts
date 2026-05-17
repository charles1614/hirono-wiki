import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { autoDetect } from "../hirono/auto-detect-entities.ts";

function makeRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "auto-detect-"));
  mkdirSync(join(root, "03_Sources", "2026"), { recursive: true });
  mkdirSync(join(root, "02_Entities", "_seen"), { recursive: true });
  mkdirSync(join(root, "00_Meta"), { recursive: true });
  return root;
}

function writeFile(root: string, repoPath: string, content: string): void {
  const abs = join(root, repoPath);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, content, "utf8");
}

function seedSource(root: string, slug: string, body: string): void {
  writeFile(root, `03_Sources/2026/${slug}.md`, body);
  writeFile(root, `raw/raindrop/example.com/${slug}/content.md`, "raw stub\n");
}

test("autoDetect prepare mode: writes prompt package + lists existing entities", () => {
  const root = makeRepo();
  try {
    seedSource(root, "test-slug", `---\ntype: source\n---\n\nBody about DeepSeek-V3 and Hopper GPU.\n`);
    writeFile(root, "02_Entities/DeepSeek.md", "---\ntype: entity\n---\n\n# DeepSeek\n");
    writeFile(root, "02_Entities/_seen/Hopper.md", "---\ntype: entity\n---\n\n# Hopper\n");

    const r = autoDetect(root, "test-slug");
    assert.equal(r.mode, "prepare");
    assert.ok(r.promptPath);
    const prompt = readFileSync(join(root, r.promptPath!), "utf8");
    assert.ok(prompt.includes("DeepSeek-V3"), "Source body content in prompt");
    assert.ok(prompt.includes("- DeepSeek"), "active entity listed");
    assert.ok(prompt.includes("- Hopper"), "seen entity listed");
    assert.ok(prompt.includes("test-slug-entities-response.json"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("autoDetect dry-run: classifies entities against existing index", () => {
  const root = makeRepo();
  try {
    seedSource(root, "test-slug", `---\ntype: source\n---\n\nText about [[DeepSeek]] and FlashAttention.\n`);
    writeFile(root, "02_Entities/DeepSeek.md", "---\ntype: entity\n---\n\n# DeepSeek\n");
    writeFile(root, "02_Entities/_seen/Hopper.md", "---\ntype: entity\n---\n\n# Hopper\n");

    const responseJson = {
      entities: [
        { name: "DeepSeek", description: "Chinese frontier-LLM lab" },
        { name: "Hopper", description: "NVIDIA Hopper GPU architecture" },
        { name: "FlashAttention", description: "Memory-efficient attention" },
      ],
    };
    const respPath = join(root, "test-resp.json");
    writeFileSync(respPath, JSON.stringify(responseJson));

    const r = autoDetect(root, "test-slug", { responsePath: respPath });
    assert.equal(r.mode, "dryrun");
    assert.equal(r.classified!.length, 3);
    const byName = new Map(r.classified!.map(c => [c.name, c]));
    assert.equal(byName.get("DeepSeek")!.status, "exists-active");
    assert.equal(byName.get("DeepSeek")!.wikilinkedInSource, true);
    assert.equal(byName.get("Hopper")!.status, "exists-seen");
    assert.equal(byName.get("Hopper")!.wikilinkedInSource, false);
    assert.equal(byName.get("FlashAttention")!.status, "new");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("autoDetect dry-run: applies alias normalization", () => {
  const root = makeRepo();
  try {
    seedSource(root, "test-slug", `---\ntype: source\n---\n\nLLaMA model.\n`);
    writeFile(root, "02_Entities/Llama.md", "---\ntype: entity\n---\n\n# Llama\n");
    writeFile(root, "00_Meta/entity-aliases.md", "## Aliases\n\n- LLaMA → Llama\n");

    const responseJson = { entities: [{ name: "LLaMA", description: "Meta's foundation LLM" }] };
    const respPath = join(root, "test-resp.json");
    writeFileSync(respPath, JSON.stringify(responseJson));

    const r = autoDetect(root, "test-slug", { responsePath: respPath });
    assert.equal(r.classified!.length, 1);
    const c = r.classified![0];
    assert.equal(c.name, "Llama", "alias normalizes LLaMA → Llama");
    assert.equal(c.raw, "LLaMA");
    assert.equal(c.status, "exists-active");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("autoDetect apply: creates _seen/ stubs atomically + log entry", () => {
  const root = makeRepo();
  try {
    seedSource(root, "test-slug", `---\ntype: source\n---\n\nBody.\n`);
    writeFile(root, "02_Entities/DeepSeek.md", "---\ntype: entity\n---\n\n# DeepSeek\n");

    const responseJson = {
      entities: [
        { name: "DeepSeek", description: "Chinese frontier-LLM lab" },
        { name: "FlashAttention", description: "Memory-efficient attention" },
        { name: "Hopper", description: "NVIDIA datacenter GPU arch" },
      ],
    };
    const respPath = join(root, "test-resp.json");
    writeFileSync(respPath, JSON.stringify(responseJson));

    const r = autoDetect(root, "test-slug", { responsePath: respPath, apply: true });
    assert.equal(r.mode, "apply");
    assert.deepEqual(r.created?.sort(), ["FlashAttention", "Hopper"]);

    const faStub = readFileSync(join(root, "02_Entities/_seen/FlashAttention.md"), "utf8");
    assert.ok(faStub.includes("# FlashAttention"));
    assert.ok(faStub.includes("Memory-efficient attention"));
    assert.ok(faStub.includes("type: entity"));
    assert.ok(faStub.includes("tier: seen"));

    const hopperStub = readFileSync(join(root, "02_Entities/_seen/Hopper.md"), "utf8");
    assert.ok(hopperStub.includes("# Hopper"));

    // Existing entity should not be re-created
    const deepseek = readFileSync(join(root, "02_Entities/DeepSeek.md"), "utf8");
    assert.ok(!deepseek.includes("Chinese frontier-LLM lab"), "existing entity not overwritten");

    // Log entry written
    const year = new Date().getFullYear();
    const log = readFileSync(join(root, `00_Meta/log-${year}.md`), "utf8");
    assert.ok(log.includes("auto-detect-entities on [[test-slug]]"));
    assert.ok(log.includes("FlashAttention"));
    assert.ok(log.includes("Hopper"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("autoDetect apply: no-op when all entities exist", () => {
  const root = makeRepo();
  try {
    seedSource(root, "test-slug", `---\ntype: source\n---\n\nBody.\n`);
    writeFile(root, "02_Entities/DeepSeek.md", "---\ntype: entity\n---\n\n# DeepSeek\n");

    const responseJson = { entities: [{ name: "DeepSeek", description: "..." }] };
    const respPath = join(root, "test-resp.json");
    writeFileSync(respPath, JSON.stringify(responseJson));

    const r = autoDetect(root, "test-slug", { responsePath: respPath, apply: true });
    assert.deepEqual(r.created, []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("autoDetect: throws on missing Source", () => {
  const root = makeRepo();
  try {
    let threw = false;
    try { autoDetect(root, "nonexistent"); }
    catch (e) { threw = true; assert.ok((e as Error).message.includes("Source not found")); }
    assert.ok(threw);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("autoDetect: throws on missing raw archive", () => {
  const root = makeRepo();
  try {
    writeFile(root, `03_Sources/2026/test-slug.md`, `---\ntype: source\n---\n\nBody.\n`);
    // No raw archive created
    let threw = false;
    try { autoDetect(root, "test-slug"); }
    catch (e) { threw = true; assert.ok((e as Error).message.includes("raw archive not found")); }
    assert.ok(threw);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("autoDetect: malformed response JSON throws clear error", () => {
  const root = makeRepo();
  try {
    seedSource(root, "test-slug", `---\ntype: source\n---\n\nBody.\n`);
    const respPath = join(root, "bad-resp.json");
    writeFileSync(respPath, "not valid json {");
    let threw = false;
    try { autoDetect(root, "test-slug", { responsePath: respPath }); }
    catch (e) { threw = true; assert.ok((e as Error).message.includes("failed to read/parse response JSON")); }
    assert.ok(threw);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
