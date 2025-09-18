import { describe, it, expect } from "vitest";
import { inferAssetKind, parseAssetDragPayload } from "../src/core/assets/kind";
import { buildAssetHaystack } from "../src/core/assets/search";

describe("asset inference helpers", () => {
  it("detects textures and models by extension", () => {
    expect(inferAssetKind("albedo.PNG")).toBe("texture");
    expect(inferAssetKind("brick_diffuse.jpg")).toBe("texture");
    expect(inferAssetKind("mesh.glb")).toBe("model");
    expect(inferAssetKind("scene.gltf")).toBe("model");
    expect(inferAssetKind("notes.txt")).toBeNull();
  });

  it("parses drag payloads safely", () => {
    const payload = JSON.stringify({ id: "1", label: "Duck", type: "model", source: "duck.glb", builtin: true });
    expect(parseAssetDragPayload(payload)).toEqual({ id: "1", label: "Duck", type: "model", source: "duck.glb", builtin: true });
    expect(parseAssetDragPayload("bad-json")).toBeNull();
    expect(parseAssetDragPayload(JSON.stringify({ id: 1 }))).toBeNull();
  });

  it("builds a comprehensive haystack for search filtering", () => {
    const haystack = buildAssetHaystack({
      id: "42",
      label: "Duck Albedo",
      type: "texture",
      source: "duck/albedo.png",
      category: { id: "builtins", label: "Built-in" },
      tags: ["duck", "hero"],
      description: "Hero texture map",
      builtin: true,
    } as any);

    expect(haystack).toContain("duck albedo");
    expect(haystack).toContain("texture");
    expect(haystack).toContain("duck/albedo.png");
    expect(haystack).toContain("built-in");
    expect(haystack).toContain("hero texture map".toLowerCase());
  });

  it("handles missing optional fields when building the haystack", () => {
    expect(() =>
      buildAssetHaystack({
        id: "user-1",
        label: "Local HDR",
        type: "texture",
        source: "data:image/png;base64,abc",
        category: { id: "user", label: "My Assets" },
        builtin: false,
      } as any)
    ).not.toThrow();
  });
});
