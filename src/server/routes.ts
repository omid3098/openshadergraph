import index from "../index.html";
import { languagesHandler, languagePackHandler, compileHandler } from "./handlers";
import { nodesListHandler, nodeTemplateHandler } from "./nodes";
import { assetsHandler } from "./assets";
import { examplesHandler } from "./examples";

export function buildRoutes() {
  const IMMUTABLE_MAX_AGE = 31536000; // 1 year
  const immutable = (res: Response) => new Response(res.body, {
    headers: {
      ...Object.fromEntries(res.headers.entries()),
      "Cache-Control": `public, max-age=${IMMUTABLE_MAX_AGE}, immutable`,
    },
    status: res.status,
    statusText: res.statusText,
  });

  return {
    "/*": index,
    // Serve precompressed bundles with immutable caching in dev server
    "/data/nodes.bundle.json": async () => immutable(new Response(Bun.file("dist/data/nodes.bundle.json"))),
    "/data/languages.bundle.json": async () => immutable(new Response(Bun.file("dist/data/languages.bundle.json"))),
    // hashed variants
    "/data/nodes.bundle.:hash.json": async (_req: any, params: any) => immutable(new Response(Bun.file(`dist/data/nodes.bundle.${params.hash}.json`))),
    "/data/languages.bundle.:hash.json": async (_req: any, params: any) => immutable(new Response(Bun.file(`dist/data/languages.bundle.${params.hash}.json`))),
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
