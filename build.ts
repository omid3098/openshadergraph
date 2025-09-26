#!/usr/bin/env bun
import { build, type BuildConfig } from "bun";
import plugin from "bun-plugin-tailwind";
import { existsSync } from "fs";
import { rm, cp, mkdir, writeFile, readdir, readFile, stat } from "fs/promises";
import path from "path";
import { gzipSync, brotliCompressSync, constants as zlibConstants } from "zlib";
import { validateLanguagePack, validateNodeTemplate } from "./src/core/schema/validators";

// Print help text if requested
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
🏗️  Bun Build Script

Usage: bun run build.ts [options]

Common Options:
  --outdir <path>          Output directory (default: "dist")
  --minify                 Enable minification (or --minify.whitespace, --minify.syntax, etc)
  --source-map <type>      Sourcemap type: none|linked|inline|external
  --target <target>        Build target: browser|bun|node
  --format <format>        Output format: esm|cjs|iife
  --splitting              Enable code splitting
  --packages <type>        Package handling: bundle|external
  --public-path <path>     Public path for assets
  --env <mode>             Environment handling: inline|disable|prefix*
  --conditions <list>      Package.json export conditions (comma separated)
  --external <list>        External packages (comma separated)
  --banner <text>          Add banner text to output
  --footer <text>          Add footer text to output
  --define <obj>           Define global constants (e.g. --define.VERSION=1.0.0)
  --help, -h               Show this help message

Example:
  bun run build.ts --outdir=dist --minify --source-map=linked --external=react,react-dom
`);
  process.exit(0);
}

// Helper function to convert kebab-case to camelCase
const toCamelCase = (str: string): string => {
  return str.replace(/-([a-z])/g, (_match: string, p1: string) => p1.toUpperCase());
};

// Helper function to parse a value into appropriate type
const parseValue = (value: string): any => {
  // Handle true/false strings
  if (value === "true") return true;
  if (value === "false") return false;

  // Handle numbers
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (/^\d*\.\d+$/.test(value)) return parseFloat(value);

  // Handle arrays (comma-separated)
  if (value.includes(",")) return value.split(",").map(v => v.trim());

  // Default to string
  return value;
};

// Magical argument parser that converts CLI args to BuildConfig
function parseArgs(): Partial<BuildConfig> {
  const config: Record<string, any> = {};
  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    const current = args[i];
    if (!current || !current.startsWith("--")) continue;

    // Handle --no-* flags
    if (current.startsWith("--no-")) {
      const rawKey = current.slice(5);
      const key = toCamelCase(rawKey);
      config[key] = false;
      continue;
    }

    // Handle --key=value form
    const eqIndex = current.indexOf("=");
    let rawKey = "";
    let rawValue: string | undefined;
    if (eqIndex !== -1) {
      rawKey = current.slice(2, eqIndex);
      rawValue = current.slice(eqIndex + 1);
    } else {
      rawKey = current.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        rawValue = next;
        i++;
      } else {
        // Bare flag implies true
        rawValue = "true";
      }
    }

    let key = toCamelCase(rawKey);
    const value = String(rawValue ?? "");

    // Handle nested properties (e.g. --minify.whitespace)
    if (key.includes(".")) {
      const parts = key.split(".", 2);
      const parentKey = parts[0] ?? "";
      const childKey = parts[1] ?? "";
      if (!parentKey) continue;
      config[parentKey] = config[parentKey] || {};
      if (childKey) config[parentKey][childKey] = parseValue(value);
    } else {
      if (!key) continue;
      config[key] = parseValue(value);
    }
  }

  return config as Partial<BuildConfig>;
}

// Helper function to format file sizes
const formatFileSize = (bytes: number): string => {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

console.log("\n🚀 Starting build process...\n");
function runGit(args: string[]): { ok: boolean; stdout: string } {
  try {
    const res = Bun.spawnSync({ cmd: ["git", ...args], stdout: "pipe", stderr: "pipe" });
    if (res.exitCode !== 0) return { ok: false, stdout: "" };
    return { ok: true, stdout: new TextDecoder().decode(res.stdout).trim() };
  } catch (_err) {
    return { ok: false, stdout: "" };
  }
}

async function computeAndWriteVersionModule(): Promise<{ version: string; bumped: boolean }> {
  // Ignore git and tags. Use committed src/version.ts as the single source of truth.
  const target = path.resolve(process.cwd(), "src", "version.ts");
  let versionStr = "0.0.0";
  try {
    const raw = await readFile(target, "utf8");
    const m = raw.match(/APP_VERSION\s*=\s*"([^"]+)"/);
    if (m && m[1]) versionStr = m[1];
  } catch (_err) {
    // As a last resort, fall back to package.json version
    try {
      const pkgRaw = await readFile(path.resolve(process.cwd(), "package.json"), "utf8");
      const pkg = JSON.parse(pkgRaw);
      if (pkg?.version && typeof pkg.version === "string") versionStr = pkg.version;
    } catch (_err2) { /* ignore */ }
  }
  console.log(`🔖 Using committed src/version.ts → v${versionStr}`);
  return { version: versionStr, bumped: false };
}

await computeAndWriteVersionModule();

// In watch mode, monitor git HEAD and dirty state; bump version module on change
function startGitVersionMonitor() {
  let lastSig = "";
  const refreshSig = (): string => {
    const head = runGit(["rev-parse", "HEAD"]).stdout;
    const dirty = runGit(["status", "--porcelain"]).stdout.length > 0 ? "*" : "";
    return `${head}${dirty}`;
  };
  lastSig = refreshSig();
  setInterval(async () => {
    try {
      const next = refreshSig();
      if (next !== lastSig) {
        lastSig = next;
        await computeAndWriteVersionModule();
      }
    } catch (_err) {
      // ignore transient git errors
    }
  }, 2000);
}

if (process.argv.includes("--watch")) {
  startGitVersionMonitor();
}

// Parse CLI arguments with our magical parser
const cliConfig = parseArgs();
const outdir = cliConfig.outdir || path.join(process.cwd(), "dist");

if (existsSync(outdir)) {
  console.log(`🗑️ Cleaning previous build at ${outdir}`);
  await rm(outdir, { recursive: true, force: true });
}

const start = performance.now();

// Scan for all HTML files in the project
const entrypoints = [...new Bun.Glob("**.html").scanSync("src")]
  .map(a => path.resolve("src", a))
  .filter(dir => !dir.includes("node_modules"));
console.log(`📄 Found ${entrypoints.length} HTML ${entrypoints.length === 1 ? "file" : "files"} to process\n`);

// Build all the HTML files
const result = await build({
  entrypoints,
  outdir,
  plugins: [plugin],
  minify: true,
  target: "browser",
  sourcemap: "linked",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  ...cliConfig, // Merge in any CLI-provided options
});

// Print the results
const end = performance.now();

const outputTable = result.outputs.map(output => ({
  "File": path.relative(process.cwd(), output.path),
  "Type": output.kind,
  "Size": formatFileSize(output.size),
}));

console.table(outputTable);
const buildTime = (end - start).toFixed(2);

// Copy runtime data directories needed by the server/ui
async function copyIfExists(srcRel: string, destRel: string) {
  const srcAbs = path.resolve(process.cwd(), srcRel);
  const destAbs = path.resolve(outdir, destRel);
  if (!existsSync(srcAbs)) return;
  await cp(srcAbs, destAbs, { recursive: true, force: true });
  console.log(`📦 Copied ${srcRel} → ${path.relative(process.cwd(), destAbs)}`);
}

await copyIfExists("data", "data");
await copyIfExists("examples", "examples");

// Generate indices (optional for server builds; kept for convenience)
async function* walk(dir: string, prefix = ""): AsyncGenerator<{ rel: string; abs: string; isDir: boolean }> {
  const entries = await readdir(dir, { withFileTypes: true } as any);
  for (const e of entries as any[]) {
    const rel = path.join(prefix, e.name);
    const abs = path.join(dir, e.name);
    const s = await stat(abs);
    const isDir = s.isDirectory();
    yield { rel, abs, isDir };
    if (isDir) yield* walk(abs, rel);
  }
}

async function generateNodesIndex() {
  const root = path.resolve(process.cwd(), "data", "nodes");
  if (!existsSync(root)) return;
  const items: Array<{ type: string; name: string; path: string; category: string }> = [];
  for await (const entry of walk(root)) {
    if (entry.isDir) continue;
    if (!entry.rel.endsWith(".json")) continue;
    try {
      const raw = await readFile(entry.abs, "utf8");
      const json = JSON.parse(raw);
      const type = String(json.type ?? "");
      if (!type) continue;
      const name = String(json.name ?? type);
      const rel = entry.rel;
      const category = rel.includes(path.sep) ? (rel.split(path.sep)[0] ?? "root") : "root";
      items.push({ type, name, path: rel, category });
    } catch (_err) { /* ignore invalid node template */ }
  }
  const categories: Record<string, typeof items> = {};
  for (const it of items) (categories[it.category] ??= []).push(it);
  const orderedCategories = Object.keys(categories)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      name,
      nodes: (categories[name] ?? []).map((n) => ({ ...n, path: n.path })).sort((a, b) => a.name.localeCompare(b.name)),
    }));
  const out = { categories: orderedCategories, flat: items.sort((a, b) => a.name.localeCompare(b.name)) };
  const outDir = path.join(outdir, "data");
  if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "nodes.index.json"), JSON.stringify(out, null, 2), "utf8");
  console.log(`📄 Wrote data/nodes.index.json (${out.flat.length} nodes)`);
}

async function generateLanguagesIndex() {
  const root = path.resolve(process.cwd(), "data", "languages");
  if (!existsSync(root)) return;
  const items: Array<{ key: string; name: string; path: string }> = [];
  for await (const entry of walk(root)) {
    if (entry.isDir) continue;
    if (!entry.rel.endsWith(".json")) continue;
    try {
      const raw = await readFile(entry.abs, "utf8");
      const json = JSON.parse(raw);
      const key = entry.rel.replace(/\.json$/i, "");
      const name = String(json.name ?? key);
      items.push({ key, name, path: entry.rel });
    } catch (_err) { /* ignore invalid language pack */ }
  }
  items.sort((a, b) => a.name.localeCompare(b.name));
  const outDir = path.join(outdir, "data");
  if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "languages.index.json"), JSON.stringify({ languages: items }, null, 2), "utf8");
  console.log(`📄 Wrote data/languages.index.json (${items.length} languages)`);
}

async function generateExamplesIndex() {
  const root = path.resolve(process.cwd(), "examples");
  if (!existsSync(root)) return;
  const items: Array<{ key: string; label: string }> = [];
  for await (const entry of walk(root)) {
    if (entry.isDir) continue;
    if (!entry.rel.endsWith(".json")) continue;
    const base = entry.rel.replace(/\.json$/i, "");
    const key = base;
    const label = base.replace(/[_-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
    items.push({ key, label });
  }
  const outDir = path.join(outdir, "examples");
  if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "index.json"), JSON.stringify({ examples: items }, null, 2), "utf8");
  console.log(`📄 Wrote examples/index.json (${items.length} examples)`);
}

await Promise.all([generateNodesIndex(), generateLanguagesIndex(), generateExamplesIndex()]);

// Bundle helpers (previously used for static hosting). Kept optional for tooling but not required at runtime.
function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] ?? 0;
    hex += b.toString(16).padStart(2, "0");
  }
  return hex;
}

async function bundleNodes() {
  const srcRoot = path.resolve(process.cwd(), "data", "nodes");
  if (!existsSync(srcRoot)) return;
  const bundle: Record<string, unknown> = {};
  let count = 0;
  for await (const entry of walk(srcRoot)) {
    if (entry.isDir) continue;
    if (!entry.rel.endsWith(".json")) continue;
    const raw = await readFile(entry.abs, "utf8");
    try {
      const json = validateNodeTemplate(JSON.parse(raw));
      const key = entry.rel.split(path.sep).join("/");
      bundle[key] = json;
      count++;
    } catch (_err) { /* skip invalid node template */ }
  }
  const outDir = path.join(outdir, "data");
  if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });
  const min = JSON.stringify({ nodes: bundle });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(min));
  const hash = toHex(digest).slice(0, 16);
  const unhashedPath = path.join(outDir, "nodes.bundle.json");
  const hashedPath = path.join(outDir, `nodes.bundle.${hash}.json`);
  await writeFile(unhashedPath, min, "utf8");
  await writeFile(hashedPath, min, "utf8");
  console.log(`🧩 Bundled nodes → data/nodes.bundle.json (${count} files)`);
  await precompressArtifacts([unhashedPath, hashedPath]);
}

async function bundleLanguages() {
  const srcRoot = path.resolve(process.cwd(), "data", "languages");
  if (!existsSync(srcRoot)) return;
  const bundle: Record<string, unknown> = {};
  let count = 0;
  for await (const entry of walk(srcRoot)) {
    if (entry.isDir) continue;
    if (!entry.rel.endsWith(".json")) continue;
    const raw = await readFile(entry.abs, "utf8");
    try {
      const json = validateLanguagePack(JSON.parse(raw));
      const key = entry.rel.replace(/\.json$/i, "").split(path.sep).join("/");
      bundle[key] = json;
      count++;
    } catch (_err) { /* skip invalid language pack */ }
  }
  const outDir = path.join(outdir, "data");
  if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });
  const min = JSON.stringify({ languages: bundle });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(min));
  const hash = toHex(digest).slice(0, 16);
  const unhashedPath = path.join(outDir, "languages.bundle.json");
  const hashedPath = path.join(outDir, `languages.bundle.${hash}.json`);
  await writeFile(unhashedPath, min, "utf8");
  await writeFile(hashedPath, min, "utf8");
  console.log(`🧩 Bundled languages → data/languages.bundle.json (${count} files)`);
  await precompressArtifacts([unhashedPath, hashedPath]);
}

await Promise.all([bundleNodes(), bundleLanguages()]);

// Emit a manifest with counts and content hashes for bundles
async function emitManifest() {
  const outDir = path.join(outdir, "data");
  if (!existsSync(outDir)) return;
  const manifest: Record<string, any> = { version: 1, generatedAt: new Date().toISOString() };
  const files = [
    "nodes.bundle.json",
    ...[...new Bun.Glob("nodes.bundle.*.json").scanSync(outDir)].map((p) => path.basename(p)),
    "languages.bundle.json",
    ...[...new Bun.Glob("languages.bundle.*.json").scanSync(outDir)].map((p) => path.basename(p)),
  ];
  for (const fname of files) {
    const abs = path.join(outDir, fname);
    if (!existsSync(abs)) continue;
    const buf = await readFile(abs);
    const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(buf));
    const hash = toHex(digest).slice(0, 16);
    let counts: Record<string, number> | undefined;
    try {
      const json = JSON.parse(buf.toString("utf8"));
      if (fname.startsWith("nodes.bundle")) counts = { nodes: Object.keys(json.nodes ?? {}).length };
      if (fname.startsWith("languages.bundle")) counts = { languages: Object.keys(json.languages ?? {}).length };
    } catch (_err) { /* ignore manifest parse errors */ }
    manifest[fname] = { hash, size: buf.byteLength, ...(counts ?? {}) };
  }
  await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  console.log(`🧾 Wrote data/manifest.json`);
}

await emitManifest();

// Optionally build MkDocs docs into dist/docs if mkdocs is available
async function buildDocsIfAvailable() {
  try {
    // Check if mkdocs exists on PATH
    const check = Bun.spawnSync({ cmd: ["bash", "-lc", "command -v mkdocs >/dev/null 2>&1"], stdout: "ignore", stderr: "ignore" });
    if (check.exitCode !== 0) {
      console.log("ℹ️  Skipping docs build (mkdocs not found)");
      return;
    }
    console.log("📚 Building documentation (mkdocs)...");
    const res = Bun.spawnSync({ cmd: ["mkdocs", "build", "--clean"], stdout: "pipe", stderr: "pipe" });
    if (res.exitCode === 0) {
      console.log("📚 Docs built → dist/docs");
    } else {
      console.warn("⚠️  mkdocs build failed:", new TextDecoder().decode(res.stderr));
    }
  } catch (err) {
    console.warn("⚠️  Error during docs build:", err);
  }
}

await buildDocsIfAvailable();

console.log(`\n✅ Build completed in ${buildTime}ms\n`);

// ---------- Helpers ----------
async function precompressArtifacts(files: string[]) {
  for (const file of files) {
    try {
      const buf = await readFile(file);
      const gz = gzipSync(buf, { level: 9 });
      const br = brotliCompressSync(buf, {
        params: {
          [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
          [zlibConstants.BROTLI_PARAM_SIZE_HINT]: buf.byteLength,
        },
      });
      await writeFile(file + ".gz", gz);
      await writeFile(file + ".br", br);
      console.log(`🗜️  Compressed ${path.basename(file)} → .gz, .br`);
    } catch (err) {
      console.warn(`⚠️  Failed to precompress ${file}:`, err);
    }
  }
}
