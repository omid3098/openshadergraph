import type { GraphNode } from "../graph/types";

// Applies preview default shading model property to fragment_output nodes.
// Returns a deep-cloned graph with defaults applied; never mutates input.
export function withPreviewShadingDefaults<T extends GraphNode>(root: T): T {
  const clone = JSON.parse(JSON.stringify(root)) as T;
  const apply = (n: any) => {
    if (!n || typeof n !== "object") return;
    if (n.type === "fragment_output") {
      const props: any[] = Array.isArray(n.properties) ? n.properties : (n.properties = []);
      let shading = props.find((p) => p && typeof p === "object" && p.id === "shading_model");
      if (!shading) {
        shading = { id: "shading_model", type: "enum", value: "pbr" };
        props.push(shading);
      }
      if (shading.value == null || shading.value === "") {
        shading.value = shading.default ?? "pbr";
        if (!shading.value) shading.value = "pbr";
      }
      if (Array.isArray(n.meta)) {
        n.meta = n.meta.filter((m: any) => !(typeof m === "string" && m.startsWith("shading_")));
      }
    }
    for (const c of n.nodes ?? []) apply(c);
  };
  apply(clone as any);
  return clone;
}


