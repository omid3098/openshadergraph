import { serve } from "bun";
import index from "./index.html";

const routes = {
  // Serve index.html for all unmatched routes.
  "/*": index,

  "/api/hello": {
    async GET(req: Request) {
      return Response.json({
        message: "Hello, world!",
        method: "GET",
      });
    },
    async PUT(req: Request) {
      return Response.json({
        message: "Hello, world!",
        method: "PUT",
      });
    },
  },

  "/api/hello/:name": async (req: any) => {
    const name = req.params.name;
    return Response.json({
      message: `Hello, ${name}!`,
    });
  },
} as const;

const development = (Bun.env.NODE_ENV ?? process.env.NODE_ENV) !== "production";
const desiredPort = Number(Bun.env.PORT ?? process.env.PORT ?? 3000);

let server: ReturnType<typeof serve>;
try {
  server = serve({ routes, development, port: desiredPort });
} catch (err) {
  const code = (err as any)?.code ?? String(err);
  if (String(code).includes("EADDRINUSE")) {
    console.warn(`⚠️  Port ${desiredPort} in use; selecting a free port...`);
    server = serve({ routes, development, port: 0 });
  } else {
    throw err;
  }
}

console.log(`🚀 Server running at ${server.url}`);
