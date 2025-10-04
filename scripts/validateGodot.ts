import { promises as fs } from "fs";
import { chmodSync, createWriteStream } from "fs";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { loadLanguage } from "../src/core/schema/registry";
import { GraphCompiler } from "../src/core/compiler/graphCompiler";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { ensureSurface, readExampleGraphs } from "./exampleGraphs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GODOT_REPO_LATEST = "https://api.github.com/repos/godotengine/godot/releases/latest";
const CACHE_ROOT = path.join(os.homedir(), ".cache", "openshadergraph");
const GODOT_CACHE_ROOT = path.join(CACHE_ROOT, "godot");
const PROJECT_ROOT = path.resolve(__dirname, "godot");
const GODOT_SCRIPT_RESOURCE = "res://validate_shader.gd";

function log(msg: string) {
  console.log(`[validate:godot] ${msg}`);
}

function warn(msg: string) {
  console.warn(`[validate:godot] ${msg}`);
}

type PlatformTarget = {
  assetSuffix: string;
  resolveBinaryPath: (extractDir: string, assetName: string) => string;
};

function resolvePlatformTarget(): PlatformTarget {
  const platform = process.platform;
  if (platform === "darwin") {
    return {
      assetSuffix: "macos.universal.zip",
      resolveBinaryPath: (extractDir) => path.join(extractDir, "Godot.app", "Contents", "MacOS", "Godot"),
    };
  }
  if (platform === "linux") {
    return {
      assetSuffix: "linux.x86_64.zip",
      resolveBinaryPath: (extractDir, assetName) => {
        const base = assetName.replace(/\.zip$/i, "");
        return path.join(extractDir, base);
      },
    };
  }
  throw new Error(`Unsupported platform '${platform}'. Godot validation currently supports macOS and Linux.`);
}

type ReleaseAsset = {
  name: string;
  browser_download_url: string;
};

type ReleaseResponse = {
  tag_name?: string;
  assets?: ReleaseAsset[];
};

async function fetchLatestRelease(): Promise<ReleaseAsset & { version: string }> {
  const target = resolvePlatformTarget();
  const res = await fetch(GODOT_REPO_LATEST, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "openshadergraph-validator",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to query Godot release info: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as ReleaseResponse;
  if (!Array.isArray(json.assets) || json.assets.length === 0) {
    throw new Error("Latest Godot release does not expose downloadable assets.");
  }
  const asset = json.assets.find((a) => a.name.endsWith(target.assetSuffix) && !a.name.includes("mono"));
  if (!asset) {
    throw new Error(`No matching Godot asset found for suffix '${target.assetSuffix}'.`);
  }
  const version = json.tag_name ?? asset.name;
  return { ...asset, version };
}

async function streamDownload(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Failed downloading '${url}': ${res.status} ${res.statusText}`);
  }
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  const fileStream = createWriteStream(destPath);
  // Node's stream pipeline expects a Node Readable; convert from the WHATWG ReadableStream
  // by using Readable.fromWeb and asserting the type to satisfy TypeScript.
  // The runtime behavior is correct in Node/Bun environments.
  await pipeline(Readable.fromWeb(res.body as unknown as any), fileStream);
}

async function unzipArchive(zipPath: string, destDir: string): Promise<void> {
  await fs.mkdir(destDir, { recursive: true });
  await new Promise<void>((resolve, reject) => {
    const child = spawn("unzip", ["-o", zipPath, "-d", destDir], { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Failed to unzip archive (exit ${code})`));
    });
  });
}

async function ensureGodotBinary(): Promise<{ binaryPath: string; version: string }> {
  const target = resolvePlatformTarget();
  const { resolveBinaryPath } = target;
  const release = await fetchLatestRelease();
  const versionSafe = release.version.replace(/[^0-9A-Za-z._-]/g, "_");
  const versionDir = path.join(GODOT_CACHE_ROOT, versionSafe);
  const extractedDir = path.join(versionDir, "extracted");
  const binaryPath = resolveBinaryPath(extractedDir, release.name);

  try {
    const st = await fs.stat(binaryPath);
    if (st.isFile()) {
      return { binaryPath, version: release.version };
    }
  } catch (_err) {
    // continue to download
  }

  await fs.mkdir(versionDir, { recursive: true });
  const archivePath = path.join(versionDir, release.name);
  try {
    const st = await fs.stat(archivePath);
    if (!st.isFile()) {
      throw new Error("not a file");
    }
  } catch (_err) {
    log(`Downloading Godot ${release.version} (${release.name})...`);
    await streamDownload(release.browser_download_url, archivePath);
  }

  log(`Extracting ${release.name}...`);
  await unzipArchive(archivePath, extractedDir);

  try {
    chmodSync(binaryPath, 0o755);
  } catch (_err) {
    // ignore chmod issues; binary might already be executable
  }

  const st = await fs.stat(binaryPath).catch(() => undefined);
  if (!st || !st.isFile()) {
    throw new Error(`Godot binary not found at expected path: ${binaryPath}`);
  }

  return { binaryPath, version: release.version };
}

type GodotRunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

async function runGodotBatchCompile(binary: string, shaderDir: string): Promise<GodotRunResult> {
  return new Promise<GodotRunResult>((resolve, reject) => {
    const child = spawn(binary, ["--headless", "--no-window", "--path", PROJECT_ROOT, "--script", GODOT_SCRIPT_RESOURCE], {
      env: { ...process.env, OSG_SHADER_DIR: shaderDir },
      cwd: PROJECT_ROOT,
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      warn(`Godot batch compile timeout, terminating process`);
      child.kill("SIGKILL");
    }, 5 * 60_000);
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ exitCode: code ?? -1, stdout, stderr });
    });
  });
}

type ShaderBatchEntry = {
  key: string;
  fileName: string;
};

async function prepareShaderBatch(items: Array<{ key: string; code: string }>): Promise<{ dir: string; entries: ShaderBatchEntry[]; cleanup: () => Promise<void> }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "osg-godot-batch-"));
  const entries: ShaderBatchEntry[] = [];
  for (const [index, item] of items.entries()) {
    const safeKey = item.key.replace(/[^0-9A-Za-z._-]/g, "_");
    const fileName = `${String(index).padStart(3, "0")}_${safeKey || "shader"}.gdshader`;
    const filePath = path.join(dir, fileName);
    await fs.writeFile(filePath, item.code, "utf8");
    entries.push({ key: item.key, fileName });
  }
  return {
    dir,
    entries,
    cleanup: async () => {
      await fs.rm(dir, { recursive: true, force: true });
    },
  };
}

type BatchInterpretation = {
  successes: string[];
  failures: Array<{ key: string; message: string }>;
  unknown: string[];
};

function interpretBatchResult(entries: ShaderBatchEntry[], result: GodotRunResult): BatchInterpretation {
  const fileToKey = new Map(entries.map((entry) => [entry.fileName, entry.key]));
  const successKeys = new Set<string>();
  const failureMap = new Map<string, string>();
  const unknown: string[] = [];

  const checkOrder: string[] = [];

  const stdoutLines = result.stdout.split(/\r?\n/);
  for (const rawLine of stdoutLines) {
    const line = rawLine.trim();
    if (!line) continue;

    const checkMatch = line.match(/^CHECK::(.+)$/);
    if (checkMatch) {
      checkOrder.push(checkMatch[1]);
      continue;
    }

    const okMatch = line.match(/^OK::([^:]+)::(.+)/);
    if (okMatch) {
      const file = okMatch[1];
      const key = fileToKey.get(file);
      if (key) {
        successKeys.add(key);
      } else {
        unknown.push(`[godot] Reported success for unknown file '${file}'.`);
      }
      continue;
    }

    const errMatch = line.match(/^ERROR::([^:]+)::(.*)$/);
    if (errMatch) {
      const file = errMatch[1];
      const message = errMatch[2]?.trim() ?? "Unknown error";
      const key = fileToKey.get(file);
      if (key) {
        failureMap.set(key, message || "Unknown error");
      } else {
        unknown.push(`[godot] Reported error for unknown file '${file}': ${message}`);
      }
    }
  }

  const stderrLines = result.stderr.split(/\r?\n/);
  const failureDetails = new Map<string, string[]>();
  let currentErrorLines: string[] = [];
  let activeFailureKey: string | null = null;
  for (const rawLine of stderrLines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/SHADER ERROR/i.test(line)) {
      activeFailureKey = null;
      currentErrorLines.push(line);
      continue;
    }

    if (/Shader compilation failed/i.test(line)) {
      currentErrorLines.push(line);
      const file = checkOrder.shift();
      if (!file) {
        unknown.push(`[godot] Shader compilation failed without matching file: ${currentErrorLines.join("\n")}`);
        currentErrorLines = [];
        activeFailureKey = null;
        continue;
      }
      const key = fileToKey.get(file);
      if (!key) {
        unknown.push(`[godot] Shader compilation failed for unknown file '${file}': ${currentErrorLines.join("\n")}`);
        currentErrorLines = [];
        activeFailureKey = null;
        continue;
      }
      const details = failureDetails.get(key) ?? [];
      details.push(...currentErrorLines);
      failureDetails.set(key, details);
      currentErrorLines = [];
      activeFailureKey = key;
      continue;
    }

    if (activeFailureKey) {
      const details = failureDetails.get(activeFailureKey);
      if (details) details.push(line);
      continue;
    }

    if (currentErrorLines.length) {
      currentErrorLines.push(line);
    } else {
      // Lines that precede any recognized error (e.g., script parse errors)
      unknown.push(`[godot] ${line}`);
    }
  }

  if (currentErrorLines.length) {
    unknown.push(`[godot] Unmatched stderr output: ${currentErrorLines.join(" | ")}`);
  }

  for (const [key, lines] of failureDetails.entries()) {
    failureMap.set(key, lines.join("\n"));
  }

  // Remove any successes that also have failures recorded
  for (const key of failureMap.keys()) {
    successKeys.delete(key);
  }

  for (const entry of entries) {
    if (!successKeys.has(entry.key) && !failureMap.has(entry.key)) {
      unknown.push(`[godot] No result reported for graph '${entry.key}' (file ${entry.fileName}).`);
    }
  }

  return {
    successes: Array.from(successKeys).sort(),
    failures: Array.from(failureMap.entries()).map(([key, message]) => ({ key, message })),
    unknown,
  };
}

async function main() {
  try {
    const { binaryPath, version } = await ensureGodotBinary();
    log(`Using Godot binary: ${binaryPath} (release ${version})`);

    const graphs = await readExampleGraphs(warn);
    log(`Loaded ${graphs.length} example graphs.`);

    const language = await loadLanguage("Godot");
    log(`Loaded Godot language pack: ${language.name ?? "Godot"}`);

    const compileFailures: Array<{ key: string; error: Error }> = [];
    const compiledShaders: Array<{ key: string; code: string }> = [];

    for (const { key, graph } of graphs) {
      const surface = ensureSurface(graph);
      try {
        log(`Compiling graph '${key}'...`);
        const compiler = new GraphCompiler(surface, language);
        compiler.compile();
        const code = compiler.result_code;
        compiledShaders.push({ key, code });
      } catch (err) {
        compileFailures.push({ key, error: err as Error });
        warn(`✖ ${key}: ${(err as Error).message}`);
      }
    }

    if (compileFailures.length) {
      warn(`Skipped Godot validation for ${compileFailures.length} graph(s) due to compile failures.`);
    }

    if (!compiledShaders.length) {
      warn("No shaders available for Godot validation.");
      if (compileFailures.length) {
        process.exitCode = 1;
      }
      return;
    }

    const { dir, entries, cleanup } = await prepareShaderBatch(compiledShaders);
    try {
      const result = await runGodotBatchCompile(binaryPath, dir);
      const batchFailures = interpretBatchResult(entries, result);

      for (const miss of batchFailures.unknown) {
        warn(miss);
      }

      if (compileFailures.length || batchFailures.failures.length || batchFailures.unknown.length || result.exitCode !== 0) {
        warn("Godot shader validation encountered issues:");
        for (const failure of compileFailures) {
          warn(` - ${failure.key}: ${failure.error.message}`);
        }
        for (const failure of batchFailures.failures) {
          warn(` - ${failure.key}: ${failure.message}`);
        }
        if (batchFailures.unknown.length) {
          warn(` - ${batchFailures.unknown.length} unclassified Godot stderr entries (see details above).`);
        }
        if (result.exitCode !== 0 && !batchFailures.failures.length) {
          warn(` - Godot exited with code ${result.exitCode}.`);
        }
        process.exitCode = 1;
        return;
      }

      for (const success of batchFailures.successes) {
        log(`✔ ${success}`);
      }

      log("All shaders compiled successfully in Godot.");
    } finally {
      await cleanup();
    }
  } catch (err) {
    console.error(`[validate:godot] Fatal error: ${(err as Error).stack ?? (err as Error).message}`);
    process.exitCode = 1;
  }
}

await main();
