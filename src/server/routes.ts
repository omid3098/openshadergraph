import { languagesHandler, languagePackHandler, compileHandler } from "./handlers";
import { nodesListHandler, nodeTemplateHandler } from "./nodes";
import { assetsHandler } from "./assets";
import { examplesHandler } from "./examples";

export function buildRoutes() {
  const development = (Bun.env.NODE_ENV ?? process.env.NODE_ENV) !== "production";
  // Serve the prebuilt app (dist) in both dev and prod; dev runs a build watcher separately
  const indexPath = "dist/index.html";
  const cdnBase = "https://esm.sh";

  function toCdn(spec: string): string {
    // Leave relative/absolute or protocol specifiers untouched
    if (/^(\.|\/|https?:|data:|bun:)/.test(spec)) return spec;
    // Extract base and subpath (supports scoped packages)
    let base = spec;
    let subpath = "";
    if (spec.startsWith("@")) {
      const parts = spec.split("/");
      base = parts.slice(0, 2).join("/");
      subpath = "/" + parts.slice(2).join("/");
      if (subpath === "/") subpath = "";
    } else if (spec.includes("/")) {
      const i = spec.indexOf("/");
      base = spec.slice(0, i);
      subpath = spec.slice(i);
    }
    return `${cdnBase}/${base}${subpath}?dev`;
  }

  function rewriteBareImports(code: string): string {
    // from-specifiers (import/export)
    code = code.replace(/(from\s*["'])((?![\.|\/]|https?:|data:|bun:)[^"']+)(["'])/g, (_, a, s, b) => `${a}${toCdn(s)}${b}`);
    // bare import 'pkg'
    code = code.replace(/(import\s*["'])((?![\.|\/]|https?:|data:|bun:)[^"']+)(["'])/g, (_, a, s, b) => `${a}${toCdn(s)}${b}`);
    // dynamic import("pkg")
    code = code.replace(/(import\(\s*["'])((?![\.|\/]|https?:|data:|bun:)[^"']+)(["']\s*\))/g, (_, a, s, b) => `${a}${toCdn(s)}${b}`);
    return code;
  }
  return {
    // Static file server (dist in prod, src in dev)
    "/": async () => new Response(Bun.file(indexPath)),
    "/*": async (req: Request) => {
      try {
        const url = new URL(req.url);
        const pathname = url.pathname;
        // Prevent path traversal without corrupting filenames containing dots.
        // We strip empty segments and explicit current/parent directory navigations.
        // Example: "/../src/./frontend.tsx" -> "/src/frontend.tsx"
        const safePath =
          "/" +
          pathname
            .split("/")
            .filter((segment) => segment !== "" && segment !== "." && segment !== "..")
            .join("/");
        if (!development) {
          const prodFile = Bun.file(`dist${safePath}`);
          if (await prodFile.exists()) return new Response(prodFile);
          return new Response(Bun.file(indexPath));
        }
        // Dev mode: prefer dist (prebuilt), then project-root relative
        const rel = safePath.replace(/^\/+/, "");
        const baseCandidates = [`dist/${rel}`, rel];

        // For bare/extensionless specifiers, attempt common script extensions
        const scriptExts = [".tsx", ".ts", ".jsx", ".js"] as const;
        const candidates: string[] = [];
        for (const b of baseCandidates) {
          candidates.push(b);
          // If path has no extension, try with common script extensions
          if (!/\.[a-zA-Z0-9]+$/.test(b)) {
            for (const ext of scriptExts) candidates.push(`${b}${ext}`);
            // Also support directory index files
            for (const ext of scriptExts) candidates.push(`${b}/index${ext}`);
          }
        }

        for (const p of candidates) {
          const f = Bun.file(p);
          if (!(await f.exists())) continue;
          // For non-js assets or already-built files, return as-is
          return new Response(f);
        }
      } catch (_err) {
        // ignore path parsing errors
      }
      return new Response(Bun.file(indexPath));
    },
    "/api/health": async () => Response.json({ ok: true }),
    // Static bundle routes removed; app now relies on API endpoints exclusively
    "/api/hello": {
      async GET(_req: Request) {
        return Response.json({ message: "Hello, world!", method: "GET" });
      },
      async PUT(_req: Request) {
        return Response.json({ message: "Hello, world!", method: "PUT" });
      },
    },
    "/api/hello/:name": async (req: any) => {
      const name = req.params.name;
      return Response.json({ message: `Hello, ${name}!` });
    },
    "/api/nodes": nodesListHandler,
    "/api/node-template": nodeTemplateHandler,
    "/api/assets": assetsHandler,
    "/api/languages": languagesHandler,
    "/api/language": languagePackHandler,
    "/api/compile": { async POST(req: Request) { return compileHandler(req); } },
    "/api/example-graphs": examplesHandler,
  } as const;
}

export type Routes = ReturnType<typeof buildRoutes>;
