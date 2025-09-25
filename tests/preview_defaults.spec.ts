import { describe, it, expect } from "vitest";
import { NodeBuilder } from "../src/core/graph/node";
import { withPreviewShadingDefaults } from "../src/core/preview/defaultShading";

describe("preview shading defaults", () => {
  it("adds default shading_model to fragment_output and strips shading_* meta", () => {
    const surface = new NodeBuilder("surface");
    const fragment_pass = surface.get_node_by_type("fragment_pass")!;
    const frag_out = surface.find_nested_node_by_type(fragment_pass, "fragment_output")!;

    // Simulate old graphs that carried preview-related meta
    (frag_out as any).meta = ["shading_toon", "editor_node"]; // mixed meta
    // Remove shading property to ensure default is inserted
    const props: any[] = Array.isArray((frag_out as any).properties) ? (frag_out as any).properties : [];
    (frag_out as any).properties = props.filter((p: any) => !(p && p.id === "shading_model"));

    const result = withPreviewShadingDefaults(surface.to_dict() as any);

    // Find fragment_output in cloned graph
    const rSurface = result;
    const rFragPass = (rSurface.nodes ?? []).find((n: any) => n.type === "fragment_pass")!;
    const rFragOut = (rFragPass.nodes ?? []).find((n: any) => n.type === "fragment_output")!;

    // Should have shading_model property with a concrete value
    const shading = (rFragOut.properties ?? []).find((p: any) => p && p.id === "shading_model");
    expect(shading).toBeDefined();
    expect(shading.value ?? shading.default).toBeTruthy();

    // Should strip shading_* meta tokens but keep other meta
    const meta: any[] = Array.isArray(rFragOut.meta) ? rFragOut.meta : [];
    expect(meta.find((m) => typeof m === "string" && m.startsWith("shading_"))).toBeUndefined();
    expect(meta.includes("editor_node")).toBe(true);

    // Original should remain unmutated
    const origMeta: any[] = Array.isArray((frag_out as any).meta) ? (frag_out as any).meta : [];
    expect(origMeta.includes("shading_toon")).toBe(true);
  });
});


