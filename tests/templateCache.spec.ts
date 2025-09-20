import { describe, it, expect, vi } from "vitest";
import { createTemplateCache } from "../src/core/ui/templateCache";

const sampleTemplate = { type: "color", template: "vec4 color;" } as any;

describe("template cache", () => {
  it("caches resolved templates", async () => {
    const fetcher = vi.fn().mockResolvedValue(sampleTemplate);
    const cache = createTemplateCache(fetcher);
    const template = await cache.load("color", "nodes/color.json");
    expect(template).toBe(sampleTemplate);
    expect(fetcher).toHaveBeenCalledTimes(1);

    const again = await cache.load("color", "nodes/color.json");
    expect(again).toBe(sampleTemplate);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("coalesces concurrent loads", async () => {
    const fetcher = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return sampleTemplate;
    });
    const cache = createTemplateCache(fetcher);
    const [a, b] = await Promise.all([
      cache.load("color", "nodes/color.json"),
      cache.load("color", "nodes/color.json"),
    ]);
    expect(a).toBe(sampleTemplate);
    expect(b).toBe(sampleTemplate);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("resets cached entries", async () => {
    const fetcher = vi.fn().mockResolvedValue(sampleTemplate);
    const cache = createTemplateCache(fetcher);
    await cache.load("color", "nodes/color.json");
    cache.reset();
    await cache.load("color", "nodes/color.json");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
