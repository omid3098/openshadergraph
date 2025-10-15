import { describe, it, expect } from "vitest";
import { extractNodeAliases } from "../nodeMeta";

describe("extractNodeAliases", () => {
  it("returns an empty array when meta is not an array", () => {
    expect(extractNodeAliases(undefined)).toEqual([]);
    expect(extractNodeAliases(null)).toEqual([]);
    expect(extractNodeAliases({})).toEqual([]);
  });

  it("extracts aliases from object metadata", () => {
    const result = extractNodeAliases([
      { aliases: ["split", "decompose"] },
      { alias: "join" },
      { searchAliases: ["merge"] },
    ]);
    expect(result.sort()).toEqual(["decompose", "join", "merge", "split"]);
  });

  it("deduplicates aliases and trims values", () => {
    const result = extractNodeAliases([
      { aliases: [" split", "split", ""] },
      "alias:compose ",
      { search_terms: ["compose", " join "] },
      42,
    ]);
    expect(result.sort()).toEqual(["compose", "join", "split"]);
  });

  it("ignores malformed entries", () => {
    const result = extractNodeAliases([
      { aliases: ["", null, undefined] },
      { alias: 123 },
      { search_aliases: [Symbol("noop")] },
    ] as any);
    expect(result).toEqual([]);
  });
});
