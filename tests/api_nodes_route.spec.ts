import { describe, it, expect } from "vitest";
import { nodesListHandler } from "../src/server/nodes";

describe("/api/nodes route", () => {
  it("lists categories and flat nodes", async () => {
    const res = await nodesListHandler();
    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(Array.isArray(json.categories)).toBe(true);
    expect(Array.isArray(json.flat)).toBe(true);
    if (json.flat.length) {
      const n = json.flat[0];
      expect(typeof n.type).toBe("string");
      expect(typeof n.name).toBe("string");
      expect(typeof n.path).toBe("string");
      expect(typeof n.category).toBe("string");
    }
  });
});

