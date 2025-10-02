import type { Edge, Node } from "@xyflow/react";
import { parseHandleId } from "@/core/ui/handles";

type DuplicateOffset = { x: number; y: number };

type DuplicateNodesOptions = {
  nodes: Node[];
  edges: Edge[];
  selectedIds: Set<string>;
  allocateId: () => number;
  offset?: DuplicateOffset;
};

export type DuplicateNodesResult = {
  nodesToAdd: Node[];
  edgesToAdd: Edge[];
  selection: string[];
  idMap: Map<string, string>;
};

const CONNECTION_RE = /^\.\.\/(\d+)\/(\d+)$/;

function cloneWithoutFunctions<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneWithoutFunctions(item)) as T;
  }
  if (!value || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>);
  const result: Record<string, unknown> = {};
  for (const [key, val] of entries) {
    if (typeof val === "function") continue;
    result[key] = cloneWithoutFunctions(val as unknown);
  }
  return result as unknown as T;
}

function isConnectionValue(value: unknown): value is string {
  return typeof value === "string" && CONNECTION_RE.test(value);
}

function toNumericId(id: string): number {
  const parsed = Number(id);
  return Number.isFinite(parsed) ? parsed : 0;
}

function applyOffset(position: { x: number; y: number } | undefined, offset: DuplicateOffset): { x: number; y: number } | undefined {
  if (!position) return position;
  const next = { x: position.x + offset.x, y: position.y + offset.y };
  return next;
}

function updateTemplatePosition(template: any, position: { x: number; y: number } | undefined) {
  if (!template || typeof template !== "object" || !position) return;
  template.position = [Math.round(position.x), Math.round(position.y)];
}

function resetConnectionValues(pins: any[] | undefined) {
  if (!Array.isArray(pins)) return;
  for (const pin of pins) {
    if (!pin || typeof pin !== "object") continue;
    if (isConnectionValue((pin as any).value)) {
      delete (pin as any).value;
    }
  }
}

function findPinById(pins: any[] | undefined, pinId: number): any | undefined {
  if (!Array.isArray(pins)) return undefined;
  return pins.find((pin) => pin && typeof pin === "object" && typeof pin.id === "number" && pin.id === pinId);
}

function setInputConnection(template: any, pinId: number, sourceId: string, sourcePinId: number) {
  const pin = findPinById(template?.inputs, pinId);
  if (!pin) return;
  (pin as any).value = `../${Number(sourceId)}/${sourcePinId}`;
}

function setOutputConnection(template: any, pinId: number, targetId: string, targetPinId: number) {
  const pin = findPinById(template?.outputs, pinId);
  if (!pin) return;
  (pin as any).value = `../${Number(targetId)}/${targetPinId}`;
}

function duplicateEdge(edge: Edge, sourceId: string, targetId: string, index: number): Edge {
  const clone = cloneWithoutFunctions(edge);
  clone.id = `dup:${edge.id}:${index}`;
  clone.source = sourceId;
  clone.target = targetId;
  if ((clone as any).selected) (clone as any).selected = false;
  return clone;
}

function normalizeSelection(nodes: Node[], selectedIds: Set<string>): Node[] {
  return nodes
    .filter((node) => selectedIds.has(node.id))
    .sort((a, b) => {
      const aNum = toNumericId(String(a.id));
      const bNum = toNumericId(String(b.id));
      if (aNum !== bNum) return aNum - bNum;
      return String(a.id).localeCompare(String(b.id));
    });
}

export function duplicateNodes(options: DuplicateNodesOptions): DuplicateNodesResult {
  const { nodes, edges, selectedIds, allocateId } = options;
  const offset: DuplicateOffset = options.offset ?? { x: 0, y: 0 };

  if (!selectedIds.size) {
    return { nodesToAdd: [], edgesToAdd: [], selection: [], idMap: new Map() };
  }

  const selectedNodes = normalizeSelection(nodes, selectedIds);
  if (!selectedNodes.length) {
    return { nodesToAdd: [], edgesToAdd: [], selection: [], idMap: new Map() };
  }

  const idMap = new Map<string, string>();
  for (const node of selectedNodes) {
    const nextIdNum = allocateId();
    const nextId = String(nextIdNum);
    idMap.set(node.id, nextId);
  }

  const clones: Node[] = [];
  const templateByNewId = new Map<string, any>();

  for (const node of selectedNodes) {
    const cloned = cloneWithoutFunctions(node);
    const newId = idMap.get(node.id)!;
    cloned.id = newId;
    if ((cloned as any).selected) (cloned as any).selected = false;
    if ((cloned as any).dragging) delete (cloned as any).dragging;
    cloned.position = {
      x: (node.position?.x ?? 0) + offset.x,
      y: (node.position?.y ?? 0) + offset.y,
    } as any;
    if ("positionAbsolute" in cloned) {
      const absolute = (node as any).positionAbsolute as { x: number; y: number } | undefined;
      if (absolute) {
        (cloned as any).positionAbsolute = applyOffset(absolute, offset);
      }
    }
    const originalParentId = (node as any).parentId as string | undefined;
    if (originalParentId && selectedIds.has(originalParentId)) {
      const mappedParent = idMap.get(originalParentId);
      (cloned as any).parentId = mappedParent ?? originalParentId;
    } else if (originalParentId) {
      (cloned as any).parentId = originalParentId;
    } else if ((cloned as any).parentId) {
      delete (cloned as any).parentId;
    }

    const data = (cloned as any).data;
    if (data && typeof data === "object") {
      const template = cloneWithoutFunctions((data as any).template);
      const defaults = cloneWithoutFunctions((data as any).templateDefaults);
      if (template && typeof template === "object") {
        template.id = Number(newId);
        templateByNewId.set(newId, template);
        resetConnectionValues(template.inputs);
        resetConnectionValues(template.outputs);
        updateTemplatePosition(template, cloned.position);
      }
      if (defaults && typeof defaults === "object") {
        defaults.id = Number(newId);
        updateTemplatePosition(defaults, cloned.position);
        (data as any).templateDefaults = defaults;
      }
      if (template) (data as any).template = template;
    }

    clones.push(cloned);
  }

  const selectedEdgeList = edges
    .filter((edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  const edgesToAdd: Edge[] = [];
  selectedEdgeList.forEach((edge, index) => {
    const newSource = idMap.get(edge.source);
    const newTarget = idMap.get(edge.target);
    if (!newSource || !newTarget) return;
    const sourceTemplate = templateByNewId.get(newSource);
    const targetTemplate = templateByNewId.get(newTarget);
    const sourcePinId = parseHandleId(edge.sourceHandle ?? undefined);
    const targetPinId = parseHandleId(edge.targetHandle ?? undefined);
    if (targetTemplate) setInputConnection(targetTemplate, targetPinId, newSource, sourcePinId);
    if (sourceTemplate) setOutputConnection(sourceTemplate, sourcePinId, newTarget, targetPinId);
    edgesToAdd.push(duplicateEdge(edge, newSource, newTarget, index));
  });

  return {
    nodesToAdd: clones,
    edgesToAdd,
    selection: clones.map((node) => node.id),
    idMap,
  };
}
