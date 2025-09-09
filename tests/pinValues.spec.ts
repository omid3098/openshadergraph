import { describe, it, expect } from "vitest";
import { toNumericArray, fromNumericArray } from "../src/core/ui/pinValues";

describe("pinValues", () => {
  it("converts number to array", () => {
    expect(toNumericArray(3)).toEqual([3]);
  });

  it("passes through array", () => {
    expect(toNumericArray([1, 2])).toEqual([1, 2]);
  });

  it("returns undefined for non-numeric", () => {
    expect(toNumericArray("a" as any)).toBeUndefined();
  });

  it("parses numeric strings", () => {
    expect(toNumericArray("1,2,3")).toEqual([1, 2, 3]);
    expect(toNumericArray("4 5 6")).toEqual([4, 5, 6]);
  });

  it("reduces single-element arrays to number", () => {
    expect(fromNumericArray([5])).toBe(5);
  });

  it("keeps multi-element arrays", () => {
    expect(fromNumericArray([1, 2])).toEqual([1, 2]);
  });
});
