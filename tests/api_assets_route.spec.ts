import { describe, it, expect } from "vitest";
import { assetsHandler } from "../src/server/assets";

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
  });

  it("ignores provider query parameters", async () => {
    const res = await assetsHandler(new Request("http://localhost/api/assets?provider=ambientcg"));
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(Array.isArray(data.categories)).toBe(true);
  });
});
