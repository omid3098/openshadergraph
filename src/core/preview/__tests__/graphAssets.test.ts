import { describe, expect, it } from "vitest";

import { collectTextureUniforms } from "../graphAssets";

describe("collectTextureUniforms", () => {
  it("uses texture property values when provided", () => {
    const graph = {
      nodes: [
        {
          id: 12,
          type: "texture",
          properties: [
            { id: "source", type: "asset", value: "https://example.com/albedo.png" },
          ],
        },
      ],
    };

    const uniforms = collectTextureUniforms(graph);

    expect(uniforms.get("texture_12")).toBe("https://example.com/albedo.png");
  });

  it("omits uniforms for blank asset values", () => {
    const graph = {
      nodes: [
        {
          id: 7,
          type: "texture",
          properties: [
            { id: "source", type: "asset", value: "" },
          ],
        },
      ],
    };

    const uniforms = collectTextureUniforms(graph);

    expect(uniforms.has("texture_7")).toBe(false);
  });
});

