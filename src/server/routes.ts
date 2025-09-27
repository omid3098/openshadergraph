import { languagesHandler, languagePackHandler, compileHandler } from "./handlers";
import { nodesListHandler, nodeTemplateHandler } from "./nodes";
import { assetsHandler } from "./assets";
import { examplesHandler } from "./examples";

export function buildRoutes() {
  const development = (Bun.env.NODE_ENV ?? process.env.NODE_ENV) !== "production";
  // Serve the prebuilt app (dist) in both dev and prod; dev runs a build watcher separately
  const indexPath = "dist/index.html";
  /**
   * Dev vs Prod path resolution
   * - Production: only serves files from dist/** and falls back to index.html. Never touches project root files.
   * - Development: prefers dist/**, then falls back to project-root candidates to aid local iteration.
   */
  // CDN rewrite helpers were previously used for dev experiments; removed to reduce noise.
  // If needed in future, reintroduce behind a feature flag.
  async function serveDocsIndexWithBase(): Promise<Response> {
    const docsIndex = Bun.file("dist/docs/index.html");
    if (!(await docsIndex.exists())) return new Response("Docs not built. Run: bun run docs:build", { status: 404 });
    try {
      const raw = await docsIndex.text();
      const hasBase = /<base\s+href="\/docs\/?"/i.test(raw);
      const html = hasBase ? raw : raw.replace(/<head(\s*[^>]*)>/i, '<head$1><base href="/docs/">');
      return new Response(html, { headers: { "content-type": "text/html;charset=utf-8" } });
    } catch (_err) {
      return new Response(docsIndex);
    }
  }
  return {
    // Static file server handled by catch-all below; explicit / path removed to avoid overshadowing /docs
    "/docs/*": async (req: Request) => {
      // Serve static files from dist/docs for any /docs/* path
      const url = new URL(req.url);
      const rel = url.pathname.replace(/^\/docs\/?/, "");
      if (rel === "") return serveDocsIndexWithBase();
      // Try exact file
      const exact = `dist/docs/${rel}`;
      const exactFile = Bun.file(exact);
      if (await exactFile.exists()) return new Response(exactFile);
      // Try directory index (e.g. /foo/ -> /foo/index.html)
      const withoutTrailing = rel.replace(/\/$/, "");
      const dirIndex = `dist/docs/${withoutTrailing}/index.html`;
      const dirIndexFile = Bun.file(dirIndex);
      if (await dirIndexFile.exists()) return new Response(dirIndexFile);
      // Try .html variant (e.g. /foo -> /foo.html)
      const htmlVariant = `dist/docs/${withoutTrailing}.html`;
      const htmlFile = Bun.file(htmlVariant);
      if (await htmlFile.exists()) return new Response(htmlFile);
      // Fallback to docs index for SPA-ish internal nav
      return await serveDocsIndexWithBase();
    },
    "/*": async (req: Request) => {
      try {
        const url = new URL(req.url);
        const pathname = url.pathname;
        // Explicitly handle /docs and /docs/* before generic resolution
        if (pathname === "/docs") {
          return await serveDocsIndexWithBase();
        }
        if (pathname.startsWith("/docs/")) {
          const docsPath = pathname.replace(/^\/docs\/?/, "");
          // Try exact file
          const exact = `dist/docs/${docsPath || "index.html"}`;
          let file = Bun.file(exact);
          if (await file.exists()) return new Response(file);
          // Try directory index
          const withoutTrailing = docsPath.replace(/\/$/, "");
          const dirIndex = `dist/docs/${withoutTrailing}/index.html`;
          file = Bun.file(dirIndex);
          if (await file.exists()) return new Response(file);
          // Try .html variant
          const htmlVariant = `dist/docs/${withoutTrailing}.html`;
          file = Bun.file(htmlVariant);
          if (await file.exists()) return new Response(file);
          return await serveDocsIndexWithBase();
        }
        if (pathname === "/") {
          return new Response(Bun.file(indexPath));
        }
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
