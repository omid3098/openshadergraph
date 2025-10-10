import { useCallback, useEffect, useRef, useState } from "react";
import type { Edge, Node } from "@xyflow/react";
import { attachNodesUpdateApi, type NodeUpdaterApi } from "./nodeUpdaters";

type NodeSnapshot = Node<any>;
type EdgeSnapshot = Edge<any>;

export type GraphSnapshot = {
  nodes: NodeSnapshot[];
  edges: EdgeSnapshot[];
  viewPath: string[];
  graphName: string;
  idCounter: number;
};

export type GraphActionType =
  | "update-input"
  | "update-property"
  | "update-asset"
  | "rename-node"
  | "add-meta"
  | "remove-meta"
  | "add-node"
  | "delete-node"
  | "move-node"
  | "resize-node"
  | "group-nodes"
  | "ungroup-node"
  | "connect"
  | "disconnect"
  | "insert-adapter"
  | "duplicate-node"
  | "paste-node"
  | "align-left"
  | "align-right"
  | "align-top"
  | "align-bottom"
  | "align-center"
  | "align-middle"
  | "distribute-horizontal"
  | "distribute-vertical"
  | "distribute-vertical-stack";

export type GraphActionMeta = {
  type: GraphActionType;
  summary?: string;
};

type GraphActionEntry = {
  meta: GraphActionMeta;
  before: GraphSnapshot;
  after: GraphSnapshot;
};

type PendingAction = {
  id: symbol;
  meta: GraphActionMeta;
  before: GraphSnapshot;
};

type HistoryState = {
  past: GraphActionEntry[];
  future: GraphActionEntry[];
  pending: PendingAction | null;
  isApplying: boolean;
};

type BeginOptions = {
  skipIfPending?: boolean;
};

type ActionToken = {
  cancel: () => void;
  updateMeta: (updater: (meta: GraphActionMeta) => GraphActionMeta) => void;
};

type UseGraphHistoryParams = {
  nodes: Node<any>[];
  edges: Edge<any>[];
  viewPath: string[];
  graphName: string;
  nodesRef: React.MutableRefObject<Node<any>[]>;
  edgesRef: React.MutableRefObject<Edge<any>[]>;
  viewPathRef: React.MutableRefObject<string[]>;
  graphNameRef: React.MutableRefObject<string>;
  idCounterRef: React.MutableRefObject<number>;
  nodeUpdaterApi: NodeUpdaterApi;
  setNodes: React.Dispatch<React.SetStateAction<Node<any>[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge<any>[]>>;
  setViewPath: React.Dispatch<React.SetStateAction<string[]>>;
  setGraphName: React.Dispatch<React.SetStateAction<string>>;
  resetInteractionState?: () => void;
  maxHistory?: number;
};

export type GraphHistoryApi = {
  beginAction: (meta: GraphActionMeta, options?: BeginOptions) => ActionToken;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  peekUndo: GraphActionMeta | null;
  peekRedo: GraphActionMeta | null;
  reset: () => void;
  hasPending: () => boolean;
  captureSnapshot: () => GraphSnapshot;
  pushEntryWithSnapshots: (meta: GraphActionMeta, before: GraphSnapshot, afterOverride?: GraphSnapshot) => void;
};

const DEFAULT_MAX_HISTORY = 100;

function cloneValue<T>(value: T): T {
  if (value === undefined || value === null) return value;
  if (typeof value === "function") return undefined as any;
  if (typeof value !== "object") return value;
  if (typeof (globalThis as any).structuredClone === "function") {
    try {
      return (globalThis as any).structuredClone(value);
    } catch (_err) {
      /* fall back */
    }
  }
  return JSON.parse(JSON.stringify(value));
}

function sanitizeNode(node: Node<any>): NodeSnapshot {
  const base: any = { ...node };
  const data = (node as any)?.data;
  if (data && typeof data === "object") {
    const nextData: Record<string, unknown> = {};
    for (const key of Object.keys(data)) {
      const val = (data as any)[key];
      if (typeof val === "function") continue;
      nextData[key] = cloneValue(val);
    }
    base.data = nextData;
  } else if (data !== undefined) {
    base.data = cloneValue(data);
  } else {
    delete base.data;
  }
  // ReactFlow augments nodes with internal symbols; cloneValue strips them already.
  return cloneValue(base);
}

function sanitizeEdge(edge: Edge<any>): EdgeSnapshot {
  return cloneValue(edge);
}

function cloneNodes(nodes: Node<any>[]): NodeSnapshot[] {
  return nodes.map((node) => sanitizeNode(node));
}

function cloneEdges(edges: Edge<any>[]): EdgeSnapshot[] {
  return edges.map((edge) => sanitizeEdge(edge));
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (typeof a === "object") {
    const keysA = Object.keys(a as object);
    const keysB = Object.keys(b as object);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
      if (!deepEqual((a as any)[key], (b as any)[key])) return false;
    }
    return true;
  }
  return false;
}

function snapshotsEqual(a: GraphSnapshot, b: GraphSnapshot): boolean {
  return (
    a.idCounter === b.idCounter &&
    a.graphName === b.graphName &&
    deepEqual(a.viewPath, b.viewPath) &&
    deepEqual(a.nodes, b.nodes) &&
    deepEqual(a.edges, b.edges)
  );
}

function computeMaxNodeId(nodes: NodeSnapshot[]): number {
  let maxId = 0;
  for (const node of nodes) {
    const idNum = Number(node.id);
    if (Number.isFinite(idNum)) maxId = Math.max(maxId, idNum);
  }
  return maxId;
}

export function useGraphHistory(params: UseGraphHistoryParams): GraphHistoryApi {
  const {
    nodes,
    edges,
    viewPath,
    graphName,
    nodesRef,
    edgesRef,
    viewPathRef,
    graphNameRef,
    idCounterRef,
    nodeUpdaterApi,
    setNodes,
    setEdges,
    setViewPath,
    setGraphName,
    resetInteractionState,
    maxHistory = DEFAULT_MAX_HISTORY,
  } = params;

  const historyRef = useRef<HistoryState>({
    past: [],
    future: [],
    pending: null,
    isApplying: false,
  });

  const [, bumpVersion] = useState(0);

  const captureSnapshot = useCallback((): GraphSnapshot => ({
    nodes: cloneNodes(nodesRef.current ?? []),
    edges: cloneEdges(edgesRef.current ?? []),
    viewPath: [...(viewPathRef.current ?? [])],
    graphName: graphNameRef.current ?? "",
    idCounter: idCounterRef.current ?? computeMaxNodeId(nodesRef.current ?? []),
  }), [edgesRef, graphNameRef, idCounterRef, nodesRef, viewPathRef]);

  const applySnapshot = useCallback((snap: GraphSnapshot) => {
    const history = historyRef.current;
    history.isApplying = true;
    idCounterRef.current = snap.idCounter ?? computeMaxNodeId(snap.nodes ?? []);
    if (resetInteractionState) resetInteractionState();
    setNodes(attachNodesUpdateApi(cloneNodes(snap.nodes ?? []), nodeUpdaterApi) as any);
    setEdges(cloneEdges(snap.edges ?? []));
    setViewPath([...(snap.viewPath ?? [])]);
    setGraphName(snap.graphName ?? "");
  }, [idCounterRef, nodeUpdaterApi, resetInteractionState, setEdges, setGraphName, setNodes, setViewPath]);

  const pushEntryWithSnapshots = useCallback((meta: GraphActionMeta, before: GraphSnapshot, afterOverride?: GraphSnapshot) => {
    const history = historyRef.current;
    const beforeSnap: GraphSnapshot = {
      nodes: cloneNodes(before.nodes ?? []),
      edges: cloneEdges(before.edges ?? []),
      viewPath: [...(before.viewPath ?? [])],
      graphName: before.graphName ?? "",
      idCounter: before.idCounter ?? 0,
    };
    const afterBase = afterOverride ?? captureSnapshot();
    const afterSnap: GraphSnapshot = {
      nodes: cloneNodes(afterBase.nodes ?? []),
      edges: cloneEdges(afterBase.edges ?? []),
      viewPath: [...(afterBase.viewPath ?? [])],
      graphName: afterBase.graphName ?? "",
      idCounter: afterBase.idCounter ?? 0,
    };
    if (snapshotsEqual(beforeSnap, afterSnap)) return;
    history.past.push({ meta, before: beforeSnap, after: afterSnap });
    if (history.past.length > maxHistory) {
      history.past.splice(0, history.past.length - maxHistory);
    }
    history.future = [];
    history.pending = null;
    bumpVersion((v) => v + 1);
  }, [captureSnapshot, maxHistory]);

  const commitPending = useCallback(() => {
    const history = historyRef.current;
    const pending = history.pending;
    if (!pending) return;
    const after = captureSnapshot();
    if (snapshotsEqual(pending.before, after)) {
      history.pending = null;
      return;
    }
    history.past.push({ meta: pending.meta, before: pending.before, after });
    if (history.past.length > maxHistory) {
      history.past.splice(0, history.past.length - maxHistory);
    }
    history.future = [];
    history.pending = null;
    bumpVersion((v) => v + 1);
  }, [captureSnapshot, maxHistory]);

  useEffect(() => {
    const history = historyRef.current;
    if (history.isApplying) {
      history.isApplying = false;
      history.pending = null;
      return;
    }
    if (history.pending) commitPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, viewPath, graphName]);

  const beginAction = useCallback((meta: GraphActionMeta, options?: BeginOptions): ActionToken => {
    const history = historyRef.current;
    if (options?.skipIfPending && history.pending) {
      return {
        cancel: () => {
          if (history.pending) history.pending = null;
        },
        updateMeta: () => void 0,
      };
    }
    const before = captureSnapshot();
    const id = Symbol("graph-action");
    history.pending = { id, meta, before };
    return {
      cancel: () => {
        if (history.pending && history.pending.id === id) {
          history.pending = null;
        }
      },
      updateMeta: (updater) => {
        if (history.pending && history.pending.id === id) {
          history.pending.meta = updater(history.pending.meta);
        }
      },
    };
  }, [captureSnapshot]);

  const undo = useCallback(() => {
    const history = historyRef.current;
    if (!history.past.length) return;
    const entry = history.past.pop()!;
    history.future.push(entry);
    history.pending = null;
    applySnapshot(entry.before);
    bumpVersion((v) => v + 1);
  }, [applySnapshot]);

  const redo = useCallback(() => {
    const history = historyRef.current;
    if (!history.future.length) return;
    const entry = history.future.pop()!;
    history.past.push(entry);
    history.pending = null;
    applySnapshot(entry.after);
    bumpVersion((v) => v + 1);
  }, [applySnapshot]);

  const reset = useCallback(() => {
    const history = historyRef.current;
    history.past = [];
    history.future = [];
    history.pending = null;
    history.isApplying = false;
    bumpVersion((v) => v + 1);
  }, []);

  const canUndo = historyRef.current.past.length > 0;
  const canRedo = historyRef.current.future.length > 0;
  const peekUndo = historyRef.current.past.length ? historyRef.current.past[historyRef.current.past.length - 1]!.meta : null;
  const peekRedo = historyRef.current.future.length ? historyRef.current.future[historyRef.current.future.length - 1]!.meta : null;

  const hasPending = useCallback(() => historyRef.current.pending !== null, []);

  return {
    beginAction,
    undo,
    redo,
    canUndo,
    canRedo,
    peekUndo,
    peekRedo,
    reset,
    hasPending,
    captureSnapshot,
    pushEntryWithSnapshots,
  };
}
