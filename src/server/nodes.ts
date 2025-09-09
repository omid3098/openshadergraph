import { getNodePalette, getNodeTemplate } from "@/core/schema/registry";

export async function nodesListHandler(): Promise<Response> {
  try {
    const palette = getNodePalette();
    return Response.json(palette);
  } catch (err) {
    console.error("/api/nodes failed:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function nodeTemplateHandler(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("path");
    if (!type) return new Response("Missing path", { status: 400 });
    const tmpl = getNodeTemplate(type);
    if (!tmpl) return new Response("Not Found", { status: 404 });
    return Response.json(tmpl);
  } catch (err) {
    console.error("/api/node-template failed:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}

