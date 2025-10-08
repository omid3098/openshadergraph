import { describe, it, expect, vi, beforeEach } from "vitest";
import { assetsHandler } from "../src/server/assets";
import { loadAmbientcgCategories } from "../src/server/providers/ambientcg";

vi.mock("../src/server/providers/ambientcg", () => {
  const loadAmbientcgCategoriesMock = vi.fn(async () => [
    {
      id: "ambientcg:textures",
      label: "ambientCG • Textures",
      items: [
        {
          id: "ambientcg:sample",
          label: "Sample Asset",
          type: "texture",
          source: "https://example.com/sample.png",
          builtin: true,
          preview: "https://example.com/sample.png",
          provider: {
            id: "ambientcg",
            name: "ambientCG",
            assetId: "Sample001",
            assetUrl: "https://ambientcg.com/a/Sample001",
          },
        },
      ],
    },
  ]);
  return {
    AMBIENT_CG_PROVIDER_ID: "ambientcg",
    loadAmbientcgCategories: loadAmbientcgCategoriesMock,
  };
});

const ambientCategoriesMock = vi.mocked(loadAmbientcgCategories);

beforeEach(() => {
  ambientCategoriesMock.mockClear();
});

describe("/api/assets route", () => {
  it("returns categories with asset metadata", async () => {
    const res = await assetsHandler(new Request("http://localhost/api/assets"));
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(typeof data.version).toBe("number");
    expect(Array.isArray(data.categories)).toBe(true);
    if (data.categories.length) {
      const category = data.categories[0];
      expect(typeof category.id).toBe("string");
      expect(typeof category.label).toBe("string");
      expect(Array.isArray(category.items)).toBe(true);
      if (category.items.length) {
        const item = category.items[0];
        expect(typeof item.id).toBe("string");
        expect(typeof item.label).toBe("string");
        expect(typeof item.type).toBe("string");
        expect(typeof item.source).toBe("string");
        expect(item.builtin).toBe(true);
      }
    }
    expect(ambientCategoriesMock).not.toHaveBeenCalled();
  });

  it("merges ambientcg provider categories when requested", async () => {
    const res = await assetsHandler(new Request("http://localhost/api/assets?provider=ambientcg"));
    expect(res.ok).toBe(true);
    const data = await res.json();
    const ambientCategory = (data.categories as any[]).find((cat) => cat.id === "ambientcg:textures");
    expect(ambientCategory).toBeTruthy();
    expect(Array.isArray(ambientCategory.items)).toBe(true);
    expect(ambientCategory.items[0]?.provider?.id).toBe("ambientcg");
    expect(ambientCategoriesMock).toHaveBeenCalledTimes(1);
  });
});
