import { serve } from "bun";
import { buildRoutes } from "./server/routes";

const routes = buildRoutes();

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
