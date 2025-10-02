import type { NodeChange } from "@xyflow/react";

type PositionChange = Extract<NodeChange, { type: "position" }>;
type DimensionChange = Extract<NodeChange, { type: "dimensions" }>;

type AnyChange = NodeChange;

export function isDragStart(change: AnyChange): change is PositionChange {
  return change.type === "position" && change.dragging === true;
}

export function isDragEnd(change: AnyChange): change is PositionChange {
  return change.type === "position" && change.dragging !== true;
}

export function isResizeStart(change: AnyChange): change is DimensionChange {
  return change.type === "dimensions" && change.resizing === true;
}

export function isResizeEnd(change: AnyChange): change is DimensionChange {
  return change.type === "dimensions" && change.resizing !== true;
}
