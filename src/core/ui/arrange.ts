import type { Node, XYPosition } from "@xyflow/react";

export type AlignmentKind = "left" | "center" | "right" | "top" | "middle" | "bottom";
export type DistributionKind = "horizontal" | "vertical";

const EPSILON = 1e-3;

type NodeMetric = {
  node: Node;
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
  absoluteOffset?: XYPosition;
};

type ArrangementResult = {
  nodes: Node[];
  changed: boolean;
};

function approxEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < EPSILON;
}

function cloneNodes(nodes: Node[]): Node[] {
  return nodes.slice();
}

function computeAbsoluteOffset(node: Node): XYPosition | undefined {
  const abs = (node as any).positionAbsolute as XYPosition | undefined;
  if (!abs) return undefined;
  const position = node.position ?? { x: 0, y: 0 };
  return { x: abs.x - position.x, y: abs.y - position.y };
}

function collectMetrics(selected: Node[]): NodeMetric[] {
  return selected.map((node) => {
    const width = Number.isFinite((node as any).width) ? Number((node as any).width) : 0;
    const height = Number.isFinite((node as any).height) ? Number((node as any).height) : 0;
    const position = node.position ?? { x: 0, y: 0 };
    const left = position.x;
    const top = position.y;
    const right = left + width;
    const bottom = top + height;
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    return {
      node,
      width,
      height,
      left,
      right,
      top,
      bottom,
      centerX,
      centerY,
      absoluteOffset: computeAbsoluteOffset(node),
    } satisfies NodeMetric;
  });
}

function replaceNode(nodes: Node[], indexMap: Map<string, number>, metric: NodeMetric, position: XYPosition): boolean {
  const idx = indexMap.get(metric.node.id);
  if (idx === undefined) return false;
  const current = nodes[idx];
  const prevPosition = current.position ?? { x: 0, y: 0 };
  const hasXChange = !approxEqual(prevPosition.x, position.x);
  const hasYChange = !approxEqual(prevPosition.y, position.y);
  if (!hasXChange && !hasYChange) return false;
  const nextPosition: XYPosition = {
    x: hasXChange ? position.x : prevPosition.x,
    y: hasYChange ? position.y : prevPosition.y,
  };
  const next: Node = {
    ...current,
    position: nextPosition,
  };
  if (metric.absoluteOffset) {
    next.positionAbsolute = {
      x: nextPosition.x + metric.absoluteOffset.x,
      y: nextPosition.y + metric.absoluteOffset.y,
    } as any;
  }
  nodes[idx] = next;
  return true;
}

export function alignSelectedNodes(nodes: Node[], selectedIds: Set<string>, alignment: AlignmentKind): ArrangementResult {
  if (!selectedIds.size) return { nodes, changed: false };
  const indexMap = new Map<string, number>();
  nodes.forEach((node, index) => {
    indexMap.set(node.id, index);
  });
  const selected = nodes.filter((node) => selectedIds.has(node.id));
  if (selected.length <= 1) return { nodes, changed: false };

  const grouped = new Map<string, NodeMetric[]>();
  for (const metric of collectMetrics(selected)) {
    const parentKey = ((metric.node as any).parentId ?? "__root__") as string;
    const list = grouped.get(parentKey);
    if (list) list.push(metric);
    else grouped.set(parentKey, [metric]);
  }

  let changed = false;
  const nextNodes = cloneNodes(nodes);

  grouped.forEach((metrics) => {
    if (metrics.length <= 1) return;
    const minLeft = Math.min(...metrics.map((m) => m.left));
    const maxRight = Math.max(...metrics.map((m) => m.right));
    const minTop = Math.min(...metrics.map((m) => m.top));
    const maxBottom = Math.max(...metrics.map((m) => m.bottom));
    const midX = minLeft + (maxRight - minLeft) / 2;
    const midY = minTop + (maxBottom - minTop) / 2;

    for (const metric of metrics) {
      const position = metric.node.position ?? { x: 0, y: 0 };
      let targetX = position.x;
      let targetY = position.y;
      switch (alignment) {
        case "left":
          targetX = minLeft;
          break;
        case "center":
          targetX = midX - metric.width / 2;
          break;
        case "right":
          targetX = maxRight - metric.width;
          break;
        case "top":
          targetY = minTop;
          break;
        case "middle":
          targetY = midY - metric.height / 2;
          break;
        case "bottom":
          targetY = maxBottom - metric.height;
          break;
        default:
          break;
      }
      const applied = replaceNode(nextNodes, indexMap, metric, { x: targetX, y: targetY });
      if (applied) changed = true;
    }
  });

  return { nodes: changed ? nextNodes : nodes, changed };
}

export function distributeSelectedNodes(nodes: Node[], selectedIds: Set<string>, distribution: DistributionKind): ArrangementResult {
  if (!selectedIds.size) return { nodes, changed: false };
  const selected = nodes.filter((node) => selectedIds.has(node.id));
  if (selected.length <= 2) return { nodes, changed: false };

  const indexMap = new Map<string, number>();
  nodes.forEach((node, index) => {
    indexMap.set(node.id, index);
  });

  const grouped = new Map<string, NodeMetric[]>();
  for (const metric of collectMetrics(selected)) {
    const parentKey = ((metric.node as any).parentId ?? "__root__") as string;
    const list = grouped.get(parentKey);
    if (list) list.push(metric);
    else grouped.set(parentKey, [metric]);
  }

  let changed = false;
  const nextNodes = cloneNodes(nodes);

  let attempted = false;
  grouped.forEach((metrics) => {
    if (metrics.length <= 2) return;
    attempted = true;
    if (distribution === "horizontal") {
      const sorted = [...metrics].sort((a, b) => a.left - b.left);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const start = first.left;
      const end = last.right;
      const totalWidth = sorted.reduce((sum, metric) => sum + metric.width, 0);
      const gapCount = sorted.length - 1;
      if (gapCount <= 0) return;
      const available = end - start - totalWidth;
      const gap = available / gapCount;
      let cursor = start + first.width + gap;
      for (let i = 1; i < sorted.length - 1; i++) {
        const metric = sorted[i];
        const targetX = cursor;
        const applied = replaceNode(nextNodes, indexMap, metric, { x: targetX, y: metric.top });
        if (applied) changed = true;
        cursor = targetX + metric.width + gap;
      }
      const lastTarget = end - last.width;
      const appliedLast = replaceNode(nextNodes, indexMap, last, { x: lastTarget, y: last.top });
      if (appliedLast) changed = true;
      const appliedFirst = replaceNode(nextNodes, indexMap, first, { x: start, y: first.top });
      if (appliedFirst) changed = true;
    } else {
      const sorted = [...metrics].sort((a, b) => a.top - b.top);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const start = first.top;
      const end = last.bottom;
      const totalHeight = sorted.reduce((sum, metric) => sum + metric.height, 0);
      const gapCount = sorted.length - 1;
      if (gapCount <= 0) return;
      const available = end - start - totalHeight;
      const gap = available / gapCount;
      let cursor = start + first.height + gap;
      for (let i = 1; i < sorted.length - 1; i++) {
        const metric = sorted[i];
        const targetY = cursor;
        const applied = replaceNode(nextNodes, indexMap, metric, { x: metric.left, y: targetY });
        if (applied) changed = true;
        cursor = targetY + metric.height + gap;
      }
      const lastTarget = end - last.height;
      const appliedLast = replaceNode(nextNodes, indexMap, last, { x: last.left, y: lastTarget });
      if (appliedLast) changed = true;
      const appliedFirst = replaceNode(nextNodes, indexMap, first, { x: first.left, y: start });
      if (appliedFirst) changed = true;
    }
  });

  if (!changed && attempted) {
    return { nodes: nextNodes, changed: true };
  }

  return { nodes: changed ? nextNodes : nodes, changed };
}
