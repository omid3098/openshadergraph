import type { DocGraph } from "./DocGraph";
import type { GraphNode } from "@/core/graph/types";
import type { NodeTemplate } from "@/core/schema/types";

function cloneFromTemplate(base: NodeTemplate): GraphNode {
  const node: GraphNode = JSON.parse(JSON.stringify(base));
  // Ensure arrays and pin ids
  node.nodes ??= [] as any;
  node.inputs ??= [] as any;
  node.outputs ??= [] as any;
  node.meta ??= [] as any;
  node.properties = Array.isArray(node.properties) ? node.properties : ([] as any);
  node.inputs.forEach((p: any, i: number) => { if (typeof p.id !== "number") p.id = i; });
  node.outputs.forEach((p: any, i: number) => { if (typeof p.id !== "number") p.id = i; });
  return node;
}

export async function inflateDocGraph(doc: DocGraph, getTemplate: (type: string) => Promise<NodeTemplate | undefined>): Promise<GraphNode> {
  // Root surface → { vertex_pass, fragment_pass }
  const surfaceTpl = await getTemplate("surface");
  if (!surfaceTpl) throw new Error("Missing template: surface");
  const surface = cloneFromTemplate(surfaceTpl);
  // Locate empty child passes that surface includes by default
  const fragmentPass = (surface.nodes ?? []).find((n) => n.type === "fragment_pass");
  const vertexPass = (surface.nodes ?? []).find((n) => n.type === "vertex_pass");
  if (!fragmentPass || !vertexPass) throw new Error("Surface template missing passes");

  // Assign stable ids; reserve 0 for surface, 1 for vertex_pass, 2 for fragment_pass
  surface.id = 0 as any;
  vertexPass.id = 1 as any;
  fragmentPass.id = 2 as any;

  // Reset children of fragment/vertex passes (keep outputs)
  vertexPass.nodes = Array.isArray(vertexPass.nodes) ? vertexPass.nodes : [];
  fragmentPass.nodes = Array.isArray(fragmentPass.nodes) ? fragmentPass.nodes : [];

  // Map of provided id → actual node object under fragment_pass
  const byId = new Map<number, GraphNode>();

  for (const n of doc.nodes) {
    const tpl = await getTemplate(n.t);
    if (!tpl) throw new Error(`Missing template: ${n.t}`);
    const node = cloneFromTemplate(tpl);
    node.id = n.id as any;
    node.name = node.name ?? n.t;
    node.position = [Number(n.x ?? 0), Number(n.y ?? 0)] as any;
    // Apply provided simple props
    if (n.props && Array.isArray(node.properties)) {
      const props = node.properties as any[];
      for (let i = 0; i < props.length; i++) {
        const p = props[i];
        if (!p || typeof p !== "object" || typeof p.id !== "string") continue;
        const key = p.id;
        if (Object.prototype.hasOwnProperty.call(n.props, key)) {
          p.value = (n.props as any)[key];
        }
      }
    }
    fragmentPass.nodes!.push(node);
    byId.set(n.id, node);
  }

  // Wire edges (use canonical relative refs ../<node>/<pin>)
  for (const e of doc.edges) {
    const [fromId, fromPin] = e.from;
    const [toId, toPin] = e.to;
    const src = byId.get(fromId);
    const dst = byId.get(toId);
    if (!src || !dst) continue;
    const input = Array.isArray(dst.inputs) ? dst.inputs.find((p: any) => (typeof p.id === "number" ? p.id : -1) === toPin) : undefined;
    const output = Array.isArray(src.outputs) ? src.outputs.find((p: any) => (typeof p.id === "number" ? p.id : -1) === fromPin) : undefined;
    const toRef = `../${fromId}/${fromPin}`;
    const fromRef = `../${toId}/${toPin}`;
    if (input) (input as any).value = toRef;
    if (output) (output as any).value = fromRef;
  }

  return surface as GraphNode;
}


