import { describe, expect, it } from "vitest";
import type { NodeChange } from "@xyflow/react";
import { isDragEnd, isDragStart, isResizeEnd, isResizeStart } from "../historyGates";

describe("historyGates", () => {
  const basePosition: Extract<NodeChange, { type: "position" }> = {
    id: "node-1",
    type: "position",
    dragging: true,
    position: { x: 0, y: 0 },
  } as any;

  const baseDimensions: Extract<NodeChange, { type: "dimensions" }> = {
    id: "node-1",
    type: "dimensions",
    resizing: true,
    dimensions: { width: 120, height: 80 },
  } as any;

  it("treats explicit drag start and end correctly", () => {
    expect(isDragStart(basePosition)).toBe(true);
    expect(isDragEnd(basePosition)).toBe(false);

    const endChange = { ...basePosition, dragging: false };
    expect(isDragStart(endChange)).toBe(false);
    expect(isDragEnd(endChange)).toBe(true);
  });

  it("treats undefined drag state as drag end", () => {
    const undefinedChange = { ...basePosition, dragging: undefined };
    expect(isDragStart(undefinedChange)).toBe(false);
    expect(isDragEnd(undefinedChange)).toBe(true);
  });

  it("treats resize start and end correctly", () => {
    expect(isResizeStart(baseDimensions)).toBe(true);
    expect(isResizeEnd(baseDimensions)).toBe(false);

    const endChange = { ...baseDimensions, resizing: false };
    expect(isResizeStart(endChange)).toBe(false);
    expect(isResizeEnd(endChange)).toBe(true);
  });

  it("treats undefined resize state as resize end", () => {
    const undefinedChange = { ...baseDimensions, resizing: undefined };
    expect(isResizeStart(undefinedChange)).toBe(false);
    expect(isResizeEnd(undefinedChange)).toBe(true);
  });
});
