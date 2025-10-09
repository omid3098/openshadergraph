import type { Graph, GraphNode, InputPin, OutputPin } from "../graph/types";

const REF_RE = /^\.\.\/(\d+)\/(\d+)$/;

export type ProbeGraphIdleReason =
  | "graph-empty"
  | "probe-missing"
  | "input-missing"
  | "surface-missing"
  | "fragment-pass-missing"
  | "source-missing"
  | "cross-pass";

export type ProbeGraphResult =
  | { kind: "ready"; graph: Graph; sourceNodeId?: number }
  | { kind: "idle"; reason: ProbeGraphIdleReason };

type IndexedNode = {
  node: GraphNode;
  parent: GraphNode | null;
  surface: GraphNode | null;
  fragmentPass: GraphNode | null;
};

type IndexMaps = {
  byId: Map<number, IndexedNode>;
};

function isGraphNode(value: unknown): value is GraphNode {
  return Boolean(value && typeof value === "object" && (value as any).type);
}

function parseRef(value: unknown): { nodeId: number; pinId: number } | null {
  if (typeof value !== "string") return null;
  const match = value.match(REF_RE);
  if (!match) return null;
  const nodeId = Number(match[1]);
  const pinId = Number(match[2]);
  if (!Number.isFinite(nodeId) || !Number.isFinite(pinId)) return null;
  return { nodeId, pinId };
}

function deepClone<T>(value: T): T {
  const cloneFn = typeof (globalThis as any).structuredClone === "function" ? (globalThis as any).structuredClone : null;
  if (cloneFn) {
    try {
      return cloneFn(value);
    } catch {
      // fall through to JSON clone
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function indexGraph(root: Graph): IndexMaps {
  const byId = new Map<number, IndexedNode>();

  const visit = (node: GraphNode, parent: GraphNode | null, surface: GraphNode | null, fragmentPass: GraphNode | null) => {
    let nextSurface = surface;
    if (node.type === "surface") nextSurface = node;
    let nextPass = fragmentPass;
    if (node.type === "fragment_pass") nextPass = node;
    const nodeId = typeof node.id === "number" ? node.id : undefined;
    if (nodeId !== undefined) {
      byId.set(nodeId, { node, parent, surface: nextSurface, fragmentPass: nextPass });
    }
    if (Array.isArray(node.nodes)) {
      for (const child of node.nodes) {
        if (!isGraphNode(child)) continue;
        visit(child, node, nextSurface, nextPass);
      }
    }
  };

  if (Array.isArray(root.nodes)) {
    for (const child of root.nodes) {
      if (!isGraphNode(child)) continue;
      visit(child, null, null, null);
    }
  }

  return { byId };
}

function getInputById(node: GraphNode, targetId: number): InputPin | undefined {
  if (!Array.isArray(node.inputs)) return undefined;
  let fallback: InputPin | undefined;
  for (let i = 0; i < node.inputs.length; i++) {
    const pin = node.inputs[i];
    if (!pin) continue;
    if (typeof pin.id === "number" && pin.id === targetId) return pin;
    if (i === targetId) fallback = pin;
  }
  return fallback;
}

function setInputValue(node: GraphNode, pinId: number, value: any): void {
  if (!Array.isArray(node.inputs)) node.inputs = [];
  const input = getInputById(node, pinId);
  if (input) {
    input.value = value;
    return;
  }
  node.inputs.push({ id: pinId, name: `pin_${pinId}`, type: "float", value } as any);
}

function setBooleanProperty(node: GraphNode, propId: string, value: boolean): void {
  if (!Array.isArray(node.properties)) return;
  for (const prop of node.properties) {
    if (prop && typeof prop === "object" && (prop as any).id === propId) {
      (prop as any).value = value;
      return;
    }
  }
}

function setPropertyValue(node: GraphNode, propId: string, value: unknown): void {
  if (!Array.isArray(node.properties)) return;
  for (const prop of node.properties) {
    if (prop && typeof prop === "object" && (prop as any).id === propId) {
      (prop as any).value = value;
      return;
    }
  }
}

function cloneTreeWithFilter(node: GraphNode, includeIds: Set<number>): GraphNode | null {
  const nodeId = typeof node.id === "number" ? node.id : undefined;
  const includeSelf = nodeId !== undefined ? includeIds.has(nodeId) : false;
  const clonedChildren: GraphNode[] = [];
  if (Array.isArray(node.nodes)) {
    for (const child of node.nodes) {
      if (!isGraphNode(child)) continue;
      const cloned = cloneTreeWithFilter(child, includeIds);
      if (cloned) clonedChildren.push(cloned);
    }
  }
  if (!includeSelf && clonedChildren.length === 0) return null;
  const clone = deepClone(node);
  clone.nodes = clonedChildren;
  if (Array.isArray(clone.outputs)) {
    clone.outputs = clone.outputs.map((out: OutputPin) => ({ ...out, value: undefined }));
  }
  return clone;
}

export function buildProbeGraph(root: Graph | null | undefined, probeNodeId: number | string, options?: { pinId?: number; inputIndex?: number }): ProbeGraphResult {
  if (!root || typeof root !== "object") {
    return { kind: "idle", reason: "graph-empty" };
  }
  const probeIdNum = typeof probeNodeId === "string" ? Number(probeNodeId) : probeNodeId;
  if (!Number.isFinite(probeIdNum)) {
    return { kind: "idle", reason: "probe-missing" };
  }

  const { byId } = indexGraph(root as Graph);
  const probeEntry = byId.get(probeIdNum);
  if (!probeEntry) {
    return { kind: "idle", reason: "probe-missing" };
  }

  const probeNode = probeEntry.node;
  const pinId = options?.pinId ?? 0;
  const input = getInputById(probeNode, pinId) ?? probeNode.inputs?.[options?.inputIndex ?? 0];
  if (!input) {
    return { kind: "idle", reason: "input-missing" };
  }

  const surfaceNode = probeEntry.surface;
  if (!surfaceNode) {
    return { kind: "idle", reason: "surface-missing" };
  }
  const fragmentPassNode = probeEntry.fragmentPass;
  if (!fragmentPassNode) {
    return { kind: "idle", reason: "fragment-pass-missing" };
  }

  const ref = parseRef(input.value);
  if (!ref && (input.value === undefined || input.value === null)) {
    return { kind: "idle", reason: "input-missing" };
  }
  let sourceNodeId: number | undefined;
  const includeIds = new Set<number>();

  if (ref) {
    sourceNodeId = ref.nodeId;
    const sourceEntry = byId.get(ref.nodeId);
    if (!sourceEntry) {
      return { kind: "idle", reason: "source-missing" };
    }
    if (sourceEntry.fragmentPass !== fragmentPassNode) {
      return { kind: "idle", reason: "cross-pass" };
    }
    const stack = [ref.nodeId];
    while (stack.length) {
      const currentId = stack.pop()!;
      if (includeIds.has(currentId)) continue;
      includeIds.add(currentId);
      const currentEntry = byId.get(currentId);
      if (!currentEntry) continue;
      if (currentEntry.fragmentPass !== fragmentPassNode) {
        return { kind: "idle", reason: "cross-pass" };
      }
      const currentNode = currentEntry.node;
      if (!Array.isArray(currentNode.inputs)) continue;
      for (const pin of currentNode.inputs) {
        const nextRef = parseRef(pin?.value);
        if (!nextRef) continue;
        const nextEntry = byId.get(nextRef.nodeId);
        if (!nextEntry) {
          return { kind: "idle", reason: "source-missing" };
        }
        if (nextEntry.fragmentPass !== fragmentPassNode) {
          return { kind: "idle", reason: "cross-pass" };
        }
        stack.push(nextRef.nodeId);
      }
    }
  }

  // Include ancestors so groups/containers are preserved
  const addAncestors = (id: number) => {
    let current = byId.get(id)?.parent ?? null;
    while (current) {
      if (typeof current.id === "number") includeIds.add(current.id);
      const parentId = typeof current.id === "number" ? current.id : undefined;
      current = parentId !== undefined ? byId.get(parentId)?.parent ?? null : null;
    }
  };

  for (const id of Array.from(includeIds)) addAncestors(id);
  if (typeof fragmentPassNode.id === "number") includeIds.add(fragmentPassNode.id);
  if (typeof surfaceNode.id === "number") includeIds.add(surfaceNode.id);

  // Build filtered fragment pass tree
  const fragmentOutput = (fragmentPassNode.nodes ?? []).find((child) => isGraphNode(child) && child.type === "fragment_output") as GraphNode | undefined;
  if (!fragmentOutput) {
    return { kind: "idle", reason: "fragment-pass-missing" };
  }

  const fragmentPassClone = deepClone(fragmentPassNode);
  fragmentPassClone.nodes = [];
  if (Array.isArray(fragmentPassNode.nodes)) {
    for (const child of fragmentPassNode.nodes) {
      if (!isGraphNode(child)) continue;
      if (child.type === "fragment_output") continue;
      const cloned = cloneTreeWithFilter(child, includeIds);
      if (cloned) fragmentPassClone.nodes.push(cloned);
    }
  }

  // Inject sensible preview defaults for common procedural nodes so probes show something useful
  const injectProbeDefaults = (n: GraphNode) => {
    const visit = (node: GraphNode) => {
      const nodeType = String(node.type ?? "");
      const lowerType = nodeType.toLowerCase();
      const pins = Array.isArray(node.inputs) ? node.inputs : [];
      const getPin = (name: string) => pins.find((p: any) => String(p?.name ?? "").toLowerCase() === name);
      const isDisconnected = (pin: InputPin | undefined) => {
        if (!pin) return true;
        const v: any = (pin as any).value;
        if (typeof v === "string" && REF_RE.test(v)) return false;
        if (Array.isArray(v)) {
          // treat zero vectors as "no signal" for preview
          const nums = v.filter((x) => typeof x === "number");
          if (nums.length && nums.every((x) => Math.abs(x) < 1e-6)) return true;
        }
        return v === undefined || v === null;
      };
      // Position-like inputs: default to builtin UV so 2D procedurals vary across the screen
      if (lowerType.includes("noise")) {
        const coordinatePins = ["uv", "position", "coords"];
        for (const name of coordinatePins) {
          const target = getPin(name);
          if (!target) continue;
          if (!isDisconnected(target)) continue;
          (target as any).value = "builtin:uv";
          break;
        }
      }
      if (Array.isArray(node.nodes)) {
        for (const c of node.nodes) if (isGraphNode(c)) visit(c);
      }
    };
    visit(n);
  };

  injectProbeDefaults(fragmentPassClone);

  const fragmentOutputClone = deepClone(fragmentOutput);
  const emissionValue = ref ? `../${ref.nodeId}/${ref.pinId}` : input.value ?? 0.0;
  setInputValue(fragmentOutputClone, 0, [0.0, 0.0, 0.0]); // Albedo -> black
  setInputValue(fragmentOutputClone, 1, [0.0]); // Roughness
  setInputValue(fragmentOutputClone, 2, [0.0]); // Metallic
  setInputValue(fragmentOutputClone, 3, emissionValue); // Emission
  setInputValue(fragmentOutputClone, 5, [1.0]); // Alpha
  setInputValue(fragmentOutputClone, 23, [1.0]); // Emission Strength

  setPropertyValue(fragmentOutputClone, "shading_model", "unlit");
  setBooleanProperty(fragmentOutputClone, "enable_clearcoat", false);
  setBooleanProperty(fragmentOutputClone, "enable_transmission", false);
  setBooleanProperty(fragmentOutputClone, "enable_sss", false);
  setBooleanProperty(fragmentOutputClone, "enable_sheen", false);
  setBooleanProperty(fragmentOutputClone, "enable_anisotropy", false);
  setBooleanProperty(fragmentOutputClone, "enable_refraction", false);
  setBooleanProperty(fragmentOutputClone, "enable_backlight", false);

  fragmentPassClone.nodes.push(fragmentOutputClone);

  const surfaceClone = deepClone(surfaceNode);
  surfaceClone.nodes = [];
  if (Array.isArray(surfaceNode.nodes)) {
    for (const child of surfaceNode.nodes) {
      if (!isGraphNode(child)) continue;
      if (child.type === "fragment_pass" && child.id === fragmentPassNode.id) {
        surfaceClone.nodes.push(fragmentPassClone);
      } else {
        surfaceClone.nodes.push(deepClone(child));
      }
    }
  } else {
    surfaceClone.nodes = [fragmentPassClone];
  }

  const rootGraph: Graph = {
    type: typeof (root as any).type === "string" ? ((root as any).type as string) : "",
    name: typeof (root as any).name === "string" ? (root as any).name : "ProbePreview",
    meta: Array.isArray((root as any).meta) ? deepClone((root as any).meta) : [],
    nodes: [surfaceClone],
    inputs: Array.isArray((root as any).inputs) ? deepClone((root as any).inputs) : [],
    outputs: Array.isArray((root as any).outputs) ? deepClone((root as any).outputs) : [],
  } as Graph;

  const result: { kind: "ready"; graph: Graph; sourceNodeId?: number } = { kind: "ready", graph: rootGraph };
  if (typeof sourceNodeId === "number") result.sourceNodeId = sourceNodeId;
  return result;
}
