import { describe, it, expect } from "vitest";
import { isCompilableGraph } from "../src/core/io/guards";

describe("compile guard", () => {
  it("blocks empty objects", () => {
    expect(isCompilableGraph({})).toBe(false);
  });
  it("allows direct surface root", () => {
    expect(isCompilableGraph({ type: "surface", nodes: [] })).toBe(true);
  });
  it("allows wrapper with surface child", () => {
    expect(isCompilableGraph({ type: "", nodes: [{ id: 1, type: "surface" }] })).toBe(true);
  });
  it("blocks wrapper without surface child", () => {
    expect(isCompilableGraph({ type: "", nodes: [{ id: 1, type: "color" }] })).toBe(false);
  });
});

