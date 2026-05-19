/**
 * Cloudflare R2 client factory.
 *
 * R2 is S3-compatible; we use @aws-sdk/client-s3 against R2's endpoint.
 * Config resolution order:
 *   1. Process env vars (CI / shell)
 *   2. .wiki-r2.json at repo root (gitignored)
 *
 * Fail-fast on missing creds with a copy-pasteable setup hint.
 *
 * Single source of truth for:
 *  - the S3Client instance
 *  - the bucket name
 *  - the public base URL used for image refs in Sources
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client } from "@aws-sdk/client-s3";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(THIS_FILE), "..", "..");

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
  publicBase: string;
}

const CONFIG_FILENAME = ".wiki-r2.json";

let cachedConfig: R2Config | null = null;
let cachedClient: S3Client | null = null;

function loadFromEnv(): Partial<R2Config> {
  return {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET,
    endpoint: process.env.R2_ENDPOINT,
    publicBase: process.env.R2_PUBLIC_BASE,
  };
}

function loadFromFile(): Partial<R2Config> {
  const path = `${REPO_ROOT}/${CONFIG_FILENAME}`;
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parsed as Partial<R2Config>;
  } catch (err) {
    throw new Error(`[r2-client] failed to parse ${path}: ${(err as Error).message}`);
  }
}

const SETUP_HINT = `
Missing R2 configuration. Set env vars OR write .wiki-r2.json at repo root:

  {
    "accountId": "<from Cloudflare dashboard>",
    "accessKeyId": "<R2 API token access key>",
    "secretAccessKey": "<R2 API token secret>",
    "bucket": "wiki-raw",
    "endpoint": "https://<accountId>.r2.cloudflarestorage.com",
    "publicBase": "https://raw.<your-domain>"
  }

Env-var equivalents: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
R2_BUCKET, R2_ENDPOINT, R2_PUBLIC_BASE.

Get tokens at https://dash.cloudflare.com → R2 → Manage R2 API Tokens.
`.trim();

export function loadR2Config(): R2Config {
  if (cachedConfig) return cachedConfig;
  const file = loadFromFile();
  const env = loadFromEnv();
  const merged: Partial<R2Config> = { ...file };
  for (const [k, v] of Object.entries(env)) {
    if (v !== undefined && v !== "") (merged as Record<string, string>)[k] = v;
  }
  const missing: string[] = [];
  for (const key of ["accountId", "accessKeyId", "secretAccessKey", "bucket", "endpoint", "publicBase"] as const) {
    if (!merged[key]) missing.push(key);
  }
  if (missing.length > 0) {
    throw new Error(`[r2-client] missing required fields: ${missing.join(", ")}\n\n${SETUP_HINT}`);
  }
  cachedConfig = merged as R2Config;
  return cachedConfig;
}

export function getR2Client(): S3Client {
  if (cachedClient) return cachedClient;
  const cfg = loadR2Config();
  cachedClient = new S3Client({
    region: "auto",
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  return cachedClient;
}

export function getR2Bucket(): string {
  return loadR2Config().bucket;
}

export function getR2PublicBase(): string {
  return loadR2Config().publicBase.replace(/\/$/, "");
}

/**
 * Test-only escape hatch: inject a mocked client + config without touching
 * env or disk. Used by aws-sdk-client-mock-driven tests.
 */
export function _setR2Test(client: S3Client | null, config: R2Config | null): void {
  cachedClient = client;
  cachedConfig = config;
}

/**
 * Quick precheck callers can use to fail early. Returns the config or throws
 * the setup-hint error.
 */
export function assertR2Configured(): R2Config {
  return loadR2Config();
}
