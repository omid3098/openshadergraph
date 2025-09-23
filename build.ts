#!/usr/bin/env bun
import { build, type BuildConfig } from "bun";
import plugin from "bun-plugin-tailwind";
import { existsSync } from "fs";
import { rm, cp, mkdir, writeFile, readdir, readFile, stat } from "fs/promises";
import path from "path";

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
  return str.replace(/-([a-z])/g, g => g[1].toUpperCase());
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
    const arg = args[i];
    if (!arg.startsWith("--")) continue;

    // Handle --no-* flags
    if (arg.startsWith("--no-")) {
      const key = toCamelCase(arg.slice(5));
      config[key] = false;
      continue;
    }

    // Handle --flag (boolean true)
    if (!arg.includes("=") && (i === args.length - 1 || args[i + 1].startsWith("--"))) {
      const key = toCamelCase(arg.slice(2));
      config[key] = true;
      continue;
    }

    // Handle --key=value or --key value
    let key: string;
    let value: string;

    if (arg.includes("=")) {
      [key, value] = arg.slice(2).split("=", 2);
    } else {
      key = arg.slice(2);
      value = args[++i];
    }

    // Convert kebab-case key to camelCase
    key = toCamelCase(key);

    // Handle nested properties (e.g. --minify.whitespace)
    if (key.includes(".")) {
      const [parentKey, childKey] = key.split(".");
      config[parentKey] = config[parentKey] || {};
      config[parentKey][childKey] = parseValue(value);
    } else {
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

// Generate static indices for Cloudflare Pages Functions (no directory listing at runtime)
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
      const category = (rel.split(path.sep)[0] ?? "root");
      items.push({ type, name, path: rel, category });
    } catch {}
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
    } catch {}
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

console.log(`\n✅ Build completed in ${buildTime}ms\n`);
