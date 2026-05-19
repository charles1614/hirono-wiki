/**
 * `hirono raindrop raw-show` — operator-side debug helper.
 *
 * Sources image refs point at R2 URLs, but operator often wants to look
 * at the actual raw image / content.md while debugging an ingest or a
 * converter regression. This is a one-liner to find + list the raw
 * slug dir for inspection.
 *
 * Usage:
 *   raw-show <slug>                # list files (with sizes)
 *   raw-show <slug> --open         # macOS: `open` the dir in Finder
 *   raw-show --from-source <path>  # resolve slug from Source md path
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(THIS_FILE), "..", "..", "..");
const RAINDROP_DIR = join(REPO_ROOT, "raw", "raindrop");

interface Flags {
  slug?: string;
  fromSource?: string;
  open: boolean;
}

function parseFlags(argv: string[]): Flags {
  const f: Flags = { open: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--open": f.open = true; break;
      case "--from-source": f.fromSource = argv[++i]; break;
      case "--help": case "-h":
        printHelp(); process.exit(0);
      default:
        if (a.startsWith("-")) throw new Error(`unknown flag: ${a}`);
        if (!f.slug) f.slug = a;
        else throw new Error(`unexpected positional arg: ${a}`);
    }
  }
  return f;
}

function printHelp(): void {
  console.log(`hirono raindrop raw-show — locate + list a raw slug dir

  raw-show <slug>
  raw-show <slug> --open
  raw-show --from-source 03_Sources/2026/<slug>.md
`);
}

function findSlugDir(slug: string): { host: string; dir: string } | null {
  if (!existsSync(RAINDROP_DIR)) return null;
  for (const host of readdirSync(RAINDROP_DIR)) {
    const hostDir = join(RAINDROP_DIR, host);
    try { if (!statSync(hostDir).isDirectory()) continue; } catch { continue; }
    const candidate = join(hostDir, slug);
    try {
      if (statSync(candidate).isDirectory()) return { host, dir: candidate };
    } catch { /* continue */ }
  }
  return null;
}

function slugFromSourcePath(p: string): string {
  const name = basename(p);
  return name.endsWith(".md") ? name.slice(0, -3) : name;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export async function main(argv: string[]): Promise<void> {
  const f = parseFlags(argv);
  const slug = f.fromSource ? slugFromSourcePath(f.fromSource) : f.slug;
  if (!slug) throw new Error("provide <slug> or --from-source <path>");
  const located = findSlugDir(slug);
  if (!located) {
    console.error(`[raw-show] slug ${slug} not found under ${RAINDROP_DIR}`);
    console.error("  (raw/ is operator-local; run `hirono raindrop raw-sync --restore --slug <slug>` if you expect it on R2)");
    process.exit(1);
  }
  const { host, dir } = located;
  console.log(`${dir}`);
  console.log(`  host: ${host}`);
  console.log(`  slug: ${slug}`);
  console.log(``);
  const names = readdirSync(dir).sort();
  for (const n of names) {
    const p = join(dir, n);
    let st;
    try { st = statSync(p); } catch { continue; }
    const tag = st.isDirectory() ? "dir " : "file";
    const size = st.isFile() ? humanSize(st.size) : "";
    console.log(`  ${tag}  ${n.padEnd(40)}  ${size}`);
  }
  if (f.open) {
    if (process.platform === "darwin") {
      spawnSync("open", [dir]);
    } else {
      console.log(`(--open only supported on macOS; the dir is ${dir})`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err.stack ?? err.message ?? err);
    process.exit(1);
  });
}
