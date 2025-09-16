import { describe, it, expect } from "vitest";
import { inferAssetKind, parseAssetDragPayload } from "../src/core/assets/kind";

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
});
