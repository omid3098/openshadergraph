import { languagesHandler, languagePackHandler, compileHandler } from "./handlers";
import { nodesListHandler, nodeTemplateHandler } from "./nodes";
import { assetsHandler } from "./assets";
import { examplesHandler } from "./examples";

export function buildRoutes() {
  const development = (Bun.env.NODE_ENV ?? process.env.NODE_ENV) !== "production";
  const docsProxyOrigin = String(Bun.env.DOCS_DEV_PROXY ?? process.env.DOCS_DEV_PROXY ?? "").trim();
  // Serve the prebuilt app (dist) in both dev and prod; dev runs a build watcher separately
  const indexPath = "dist/index.html";
  /**
   * Dev vs Prod path resolution
   * - Production: only serves files from dist/** and falls back to index.html. Never touches project root files.
   * - Development: prefers dist/**, then falls back to project-root candidates to aid local iteration.
   */
  // CDN rewrite helpers were previously used for dev experiments; removed to reduce noise.
  // If needed in future, reintroduce behind a feature flag.
  // Serve docs is deprecated: disable /docs routes to simplify routing and
  // avoid noisy proxy logs. The docs remain available in-page via the app's
  // internal documentation viewer. Return 404 to prevent accidental external
  // access to `/docs` paths.
  async function serveDocsIndexWithBase(): Promise<Response> {
    // Serve the built docs index for internal consumption. We inject a base
    // href pointing at `/_internal/docs/` if the HTML doesn't already provide
    // one so asset resolution works when the iframe is served from the
    // internal path.
    const docsIndex = Bun.file("dist/docs/index.html");
    if (!(await docsIndex.exists())) return new Response("Docs not built. Run: bun run docs:build", { status: 404 });
    try {
      const raw = await docsIndex.text();
      const hasBase = /<base\s+href="\/_internal\/docs\/?"/i.test(raw) || /<base\s+href="\/docs\/?"/i.test(raw);
      const html = hasBase ? raw : raw.replace(/<head(\s*[^>]*)>/i, '<head$1><base href="/_internal/docs/">');
      return new Response(html, { headers: { "content-type": "text/html;charset=utf-8" } });
    } catch (_err) {
      return new Response(docsIndex);
    }
  }
  return {
    // Intercept common live-reload endpoints injected by mkdocs/dev servers and
    // return empty responses to prevent the client from opening many connections
    // while still serving the proxied docs HTML.
    "/livereload.js": async () => new Response("// livereload stub", { headers: { "content-type": "application/javascript" } }),
    "/livereload.js*": async () => new Response("// livereload stub", { headers: { "content-type": "application/javascript" } }),
    // mkdocs dev server polling path: /livereload/<page_id>/<poll_id>
    "/livereload/:page(\\d+)/:poll(\\d+)": async () => new Response(null, { status: 204 }),
    "/livereload/:any*": async () => new Response(null, { status: 204 }),
    "/livereload/*": async () => new Response(null, { status: 204 }),
    "/livereload": async () => new Response(null, { status: 204 }),
    "/livereload*": async () => new Response(null, { status: 204 }),
    "/sockjs-node/*": async () => new Response(null, { status: 204 }),
    "/__webpack_hmr": async () => new Response(null, { status: 204 }),
    "/__reload": async () => new Response(null, { status: 204 }),
    "/__refresh": async () => new Response(null, { status: 204 }),
    // Dev-only: catch numeric paths under /docs/ which mkdocs dev server may
    // use for polling (e.g., /docs/50813700). Return 204 for these requests to
    // suppress the polling while keeping the rest of the docs proxied.
    "/docs/:num(\\d+)": async (_req: Request, ctx: any) => {
      if (development) return new Response(null, { status: 204 });
      // In production, fall through to static handling
      try {
        return await ctx.next();
      } catch (e) {
        try {
          console.error("asset handler ctx.next() failed:", e);
        } catch (_) {
          /* ignore logging failures */
        }
        return new Response("Not found", { status: 404 });
      }
    },
    // Static file server handled by catch-all below; explicit / path removed to avoid overshadowing /docs
    "/docs/*": async (req: Request) => {
      const url = new URL(req.url);
      const rel = url.pathname.replace(/^\/docs\/?/, "");
      // Redirect top-level /docs and /docs/* to the internal docs path so the
      // app can still load docs via an iframe at /_internal/docs/ while external
      // requests to /docs are discouraged.
      const internalPath = `/_internal/docs/${rel}`;
      if (development && docsProxyOrigin) {
        try {
          if (String(Bun.env.DOCS_PROXY_DEBUG ?? process.env.DOCS_PROXY_DEBUG ?? "").toLowerCase() === "1") {
            try {
              console.log(`[docs-proxy-request] ${req.method} ${url.pathname}${url.search} -> ${new URL(`/${rel}`, docsProxyOrigin).toString()}`);
            } catch (_e) {
              /* ignore logging errors */
            }
          }
          const target = new URL(`/${rel}`, docsProxyOrigin);
          const res = await fetch(target.toString(), { headers: req.headers });
          const contentType = String(res.headers.get("content-type") ?? "").toLowerCase();
          // If the upstream served JS or HTML, read as text and strip live-reload
          // clients that mkdocs may inject. For other asset types, stream through.
          if (contentType.includes("text/html") || contentType.includes("application/javascript") || contentType.includes("text/javascript")) {
            const rawBody = await res.text();
            let body = rawBody;
            // Strip common livereload script tags (safe)
            body = body.replace(/<script[^>]+src=["'][^"']*(livereload|livereload\.js|livereload\.min\.js|\/livereload\.js)[^"']*["'][^>]*>\s*<\/script>/gi, "");
            // Only remove inline scripts that mention 'livereload' or 'snipver' to avoid
            // stripping important initialization code.
            body = body.replace(/<script[^>]*>[\s\S]*?(?:LiveReload|livereload|snipver)[\s\S]*?<\/script>/gi, "");
            // Do not aggressively strip generic WebSocket/EventSource JS since that
            // may be part of legitimate runtime code. If the cleaned result appears
            // to have lost critical mkdocs assets, fall back to the original.
            const criticalPresent = /bundle\.|assets\/javascripts\/.+bundle|id="__config"/i.test(body);
            const headers = new Headers(res.headers);
            headers.set("content-type", res.headers.get("content-type") ?? "text/plain;charset=utf-8");
            headers.delete("content-length");
            if (String(Bun.env.DOCS_PROXY_DEBUG ?? process.env.DOCS_PROXY_DEBUG ?? "").toLowerCase() === "1") {
              try {
                const snippet = body.slice(0, 200).replace(/\s+/g, " ");
                console.log(`[docs-proxy-debug] proxied ${target.toString()} cleaned snippet: ${snippet}`);
              } catch (_e) {
                /* ignore logging errors */
              }
            }
            if (!criticalPresent) {
              console.warn("[docs-proxy] cleaned proxied response appears to be missing critical assets; returning original upstream body to avoid breakage.");
              return new Response(rawBody, { status: res.status, headers });
            }
            return new Response(body, { status: res.status, headers });
          }
          return new Response(res.body, { status: res.status, headers: res.headers });
        } catch (_err) { /* fall back to static */ }
      }
      if (rel === "") return serveDocsIndexWithBase();
      const exact = `dist/docs/${rel}`;
      const exactFile = Bun.file(exact);
      if (await exactFile.exists()) return new Response(exactFile);
      const withoutTrailing = rel.replace(/\/$/, "");
      const dirIndex = `dist/docs/${withoutTrailing}/index.html`;
      const dirIndexFile = Bun.file(dirIndex);
      if (await dirIndexFile.exists()) return new Response(dirIndexFile);
      const htmlVariant = `dist/docs/${withoutTrailing}.html`;
      const htmlFile = Bun.file(htmlVariant);
      if (await htmlFile.exists()) return new Response(htmlFile);
      return await serveDocsIndexWithBase();
    },
    // Internal docs route: serve built docs directly under an internal-only path.
    "/_internal/docs/*": async (req: Request) => {
      const url = new URL(req.url);
      const rel = url.pathname.replace(/^\/_internal\/docs\/?/, "");
      if (rel === "") return serveDocsIndexWithBase();
      const exact = `dist/docs/${rel}`;
      const exactFile = Bun.file(exact);
      if (await exactFile.exists()) return new Response(exactFile);
      const withoutTrailing = rel.replace(/\/$/, "");
      const dirIndex = `dist/docs/${withoutTrailing}/index.html`;
      const dirIndexFile = Bun.file(dirIndex);
      if (await dirIndexFile.exists()) return new Response(dirIndexFile);
      const htmlVariant = `dist/docs/${withoutTrailing}.html`;
      const htmlFile = Bun.file(htmlVariant);
      if (await htmlFile.exists()) return new Response(htmlFile);
      return new Response("Not found", { status: 404 });
    },
    // Serve docs-built assets that may be referenced with absolute paths
    // (e.g., "/chunk-*.js" or "/assets/...") when they are requested from
    // the in-app documentation iframe. This fixes cases where the docs HTML
    // references absolute asset URLs and the browser requests them from the
    // root; we check `dist/docs/<path>` first and return the file if it
    // exists. Otherwise fall through to the normal handlers.
    "/:asset(.*\\.(js|css|json|map|png|svg|jpg|jpeg|webp|wasm))": async (req: Request, ctx: any) => {
      try {
        const url = new URL(req.url);
        const pathname = url.pathname.replace(/^\//, "");
        // Prefer serving assets from the main `dist/` (app bundle), then
        // fall back to `dist/docs/` (docs bundle). This avoids serving the
        // wrong HTML file when the docs index is erroneously matched.
        const appCandidate = `dist/${pathname}`;
        try {
        const fApp = Bun.file(appCandidate);
          if (await fApp.exists()) {
            // Serve with explicit MIME type to avoid strict MIME errors in browsers
            const mimeMap: Record<string, string> = {
              js: "application/javascript; charset=utf-8",
              mjs: "application/javascript; charset=utf-8",
              css: "text/css; charset=utf-8",
              json: "application/json; charset=utf-8",
              map: "application/json; charset=utf-8",
              png: "image/png",
              svg: "image/svg+xml",
              jpg: "image/jpeg",
              jpeg: "image/jpeg",
              webp: "image/webp",
              wasm: "application/wasm",
            };
            const ext = String(appCandidate).split(".").pop() ?? "";
            try {
              const buf = await fApp.arrayBuffer();
              const headers = { "content-type": mimeMap[ext] ?? "application/octet-stream" };
              return new Response(buf, { headers });
            } catch (e) {
              try { console.error("failed to read app asset:", appCandidate, e); } catch (_) {}
            }
          }
        } catch (_) {
          // ignore and try docs candidate
        }
        const docsCandidate = `dist/docs/${pathname}`;
        try {
        const fDocs = Bun.file(docsCandidate);
          if (await fDocs.exists()) {
            try {
              const ext = String(docsCandidate).split(".").pop() ?? "";
              const buf = await fDocs.arrayBuffer();
              const mimeMap: Record<string, string> = {
                js: "application/javascript; charset=utf-8",
                mjs: "application/javascript; charset=utf-8",
                css: "text/css; charset=utf-8",
                json: "application/json; charset=utf-8",
                map: "application/json; charset=utf-8",
                png: "image/png",
                svg: "image/svg+xml",
                jpg: "image/jpeg",
                jpeg: "image/jpeg",
                webp: "image/webp",
                wasm: "application/wasm",
              };
              const headers = { "content-type": mimeMap[ext] ?? "application/octet-stream" };
              return new Response(buf, { headers });
            } catch (e) {
              try { console.error("failed to read docs asset:", docsCandidate, e); } catch (_) {}
            }
          }
        } catch (_) {
          // ignore and fall through
        }
      } catch (err) {
        // On unexpected errors, log and continue to next handler rather than
        // throwing a 500 which breaks the entire app bundle loading.
        try {
          console.error("/asset handler error:", err);
        } catch (_) {
          /* ignore logging failures */
        }
      }
      return ctx.next();
    },
    "/*": async (req: Request) => {
      try {
        const url = new URL(req.url);
        const pathname = url.pathname;
        // Explicitly handle /docs and /docs/* before generic resolution
        if (pathname === "/docs" || pathname.startsWith("/docs/")) {
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
