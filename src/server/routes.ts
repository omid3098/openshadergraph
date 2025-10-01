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
  async function serveDocsIndexWithBase(): Promise<Response> {
    // Dev-time: proxy index from mkdocs if configured
    if (development && docsProxyOrigin) {
      try {
        const target = new URL("/", docsProxyOrigin);
        const res = await fetch(target.toString());
        // Fetch HTML as text so we can safely strip any dev-time live-reload
        // clients that the upstream mkdocs server may inject (EventSource/WebSocket
        // clients or livereload scripts). This prevents the iframe from opening
        // many connections when the app proxies the MkDocs dev server.
        const raw = await res.text();
        let html = raw;
        // Remove obvious livereload script tags by src (safe)
        html = html.replace(/<script[^>]+src=["'][^"']*(livereload|livereload\.js|livereload\.min\.js|\/livereload\.js)[^"']*["'][^>]*>\s*<\/script>/gi, "");
        // Remove only inline snippets that specifically mention 'livereload' or 'snipver'
        // to avoid accidentally stripping unrelated initialization code.
        html = html.replace(/<script[^>]*>[\s\S]*?(?:LiveReload|livereload|snipver)[\s\S]*?<\/script>/gi, "");
        const hasBase = /<base\s+href="\/docs\/?"/i.test(html);
        const withBase = hasBase ? html : html.replace(/<head(\s*[^>]*)>/i, '<head$1><base href="/docs/">');
        // Heuristic: if our cleaning removed critical mkdocs assets (bundle or __config),
        // fall back to the original upstream HTML to avoid breaking the page.
        const looksBroken = !/bundle\.|assets\/javascripts\/.+bundle|id="__config"/i.test(withBase);
        if (looksBroken) {
          console.warn("[docs-proxy] cleaning removed expected docs assets; returning original upstream HTML to avoid breakage.");
          return new Response(raw, { headers: { "content-type": "text/html;charset=utf-8" } });
        }
        return new Response(withBase, { headers: { "content-type": "text/html;charset=utf-8" } });
      } catch (_err) { /* fall back to static */ }
    }
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
      return ctx.next();
    },
    // Static file server handled by catch-all below; explicit / path removed to avoid overshadowing /docs
    "/docs/*": async (req: Request) => {
      const url = new URL(req.url);
      const rel = url.pathname.replace(/^\/docs\/?/, "");
      if (development && docsProxyOrigin) {
        try {
          if (String(Bun.env.DOCS_PROXY_DEBUG ?? process.env.DOCS_PROXY_DEBUG ?? "").toLowerCase() === "1") {
            try {
              console.log(`[docs-proxy-request] ${req.method} ${url.pathname}${url.search} -> ${new URL(`/${rel}`, docsProxyOrigin).toString()}`);
            } catch (e) {
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
              } catch (e) {
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
