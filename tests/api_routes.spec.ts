import { describe, it, expect } from "vitest";
import { languagesHandler, compileHandler } from "../src/server/handlers";
import { NodeBuilder } from "../src/core/graph/node";

describe("API routes: languages & compile", () => {
  it("/api/languages returns at least Godot", async () => {
    const res = await languagesHandler();
    expect(res.ok).toBe(true);
    const json = await res.json();
    const list = Array.isArray(json.languages) ? json.languages : [];
    const keys = new Set(list.map((l: any) => l.key));
    expect(keys.has("Godot")).toBe(true);
  });

  it("/api/compile compiles a wrapper graph (root type empty)", async () => {
    const surface = new NodeBuilder("surface");
    const fragment_pass = surface.get_node_by_type("fragment_pass")!;
    const fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")!;
    const color = surface.create_node("color", fragment_pass);
    surface.connect_nodes(color, fragment_output, 0, 0);
    const uiGraphStyle = {
      type: "",
      name: "Test",
      meta: [],
      nodes: [surface.to_dict()],
      inputs: [],
      outputs: [],
    } as any;

    const req = new Request("http://localhost/api/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ graph: uiGraphStyle, language: "Godot" }),
    });
    const res = await compileHandler(req);
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(typeof data.code).toBe("string");
    expect(data.code).toMatch(/shader_type spatial;/);
    expect(data.code).toMatch(/void fragment\(\) \{/);
    // No duplicates in compiled output
    const cnt = (re: RegExp) => (String(data.code).match(re) ?? []).length;
    expect(cnt(/^void vertex\(\)/gm)).toBe(1);
    expect(cnt(/^void fragment\(\)/gm)).toBe(1);
    expect(String(data.code)).not.toMatch(/^\tvoid vertex\(\)/m);
    expect(String(data.code)).not.toMatch(/^\tvoid fragment\(\)/m);
    expect(cnt(/\bALBEDO\s*=/g)).toBe(1);
  });
});
