import { languagesHandler, languagePackHandler, compileHandler } from "./handlers";
import { nodesListHandler, nodeTemplateHandler } from "./nodes";
import { assetsHandler } from "./assets";
import { examplesHandler } from "./examples";

export function buildRoutes() {
  return {
    // Static file server for production build
    "/": async () => new Response(Bun.file("dist/index.html")),
    "/*": async (req: Request) => {
      try {
        const url = new URL(req.url);
        const pathname = url.pathname;
        // Prevent path traversal; only allow within dist
        const safePath = pathname.replace(/\.\.+/g, "/");
        const filePath = `dist${safePath}`;
        const file = Bun.file(filePath);
        if (await file.exists()) {
          return new Response(file);
        }
      } catch (_err) { /* ignore path parsing errors */ }
      return new Response(Bun.file("dist/index.html"));
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
