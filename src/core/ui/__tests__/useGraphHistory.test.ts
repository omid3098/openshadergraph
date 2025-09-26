/* @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Edge, Node } from "@xyflow/react";
import { useGraphHistory, type GraphActionMeta } from "../useGraphHistory";

// Minimal helper to clone plain objects
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

type TestNode = Node<any>;
type TestEdge = Edge<any>;

type HistoryHarness = {
  nodes: TestNode[];
  edges: TestEdge[];
  updateInput: (value?: number) => void;
  updateProperty: (value?: number) => void;
  updateAsset: (source?: string) => void;
  renameNode: (label?: string) => void;
  addMeta: (meta?: string) => void;
  removeMeta: (meta?: string) => void;
  addNode: (label?: string) => void;
  deleteNode: (id?: string) => void;
  moveNode: (delta?: { x: number; y: number }) => void;
  resizeNode: (size?: { width: number; height: number }) => void;
  connectNodes: () => void;
  disconnectEdges: () => void;
  insertAdapter: () => void;
  groupNodes: () => void;
  ungroupNodes: () => void;
  primeConnection: () => void;
  primeGroup: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  peekUndo: GraphActionMeta | null;
  peekRedo: GraphActionMeta | null;
};

function createInitialNodes(): TestNode[] {
  const base: TestNode = {
    id: "1",
    type: "graphNode",
    position: { x: 0, y: 0 },
    data: {
      label: "Node 1",
      template: {
        type: "test_node",
        inputs: [{ id: 0, name: "Value", type: "float", value: [0] }],
        outputs: [{ id: 0, name: "Out", type: "float" }],
        properties: [{ id: "prop", type: "float", label: "Prop", value: 1 }],
        meta: ["editor_node", "editor_size:200x120", "custom_meta"],
      },
    },
    style: { width: 200, height: 120 },
  } as TestNode;

  const second: TestNode = {
    id: "2",
    type: "graphNode",
    position: { x: 200, y: 0 },
    data: {
      label: "Node 2",
      template: {
        type: "test_node",
        inputs: [{ id: 0, name: "Value", type: "float", value: [1] }],
        outputs: [{ id: 0, name: "Out", type: "float" }],
        properties: [],
        meta: [],
      },
    },
  } as TestNode;

  return [clone(base), clone(second)];
}

const createEdge = (id: string, source: string, target: string): TestEdge => ({
  id,
  source,
  target,
  sourceHandle: "out-0",
  targetHandle: "in-0",
  type: "default",
});

function useHistoryHarness(): HistoryHarness {
  const initialNodesRef = useRef<TestNode[]>(createInitialNodes());
  const [nodes, setNodes] = useState<TestNode[]>(() => clone(initialNodesRef.current));
  const [edges, setEdges] = useState<TestEdge[]>(() => []);
  const [viewPath, setViewPath] = useState<string[]>(() => []);
  const [graphName, setGraphName] = useState<string>(() => "TestGraph");

  const nodesRef = useRef(nodes);
  useLayoutEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const edgesRef = useRef(edges);
  useLayoutEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  const viewPathRef = useRef(viewPath);
  useLayoutEffect(() => {
    viewPathRef.current = viewPath;
  }, [viewPath]);

  const graphNameRef = useRef(graphName);
  useLayoutEffect(() => {
    graphNameRef.current = graphName;
  }, [graphName]);

  const idCounterRef = useRef<number>(initialNodesRef.current.reduce((max, node) => {
    const val = Number(node.id);
    return Number.isFinite(val) ? Math.max(max, val) : max;
  }, 0));
  const groupCounterRef = useRef<number>(0);

  const nodeUpdaterApi = useMemo(() => ({
    updateInputValue: () => {},
    updatePropertyValue: () => {},
    updateNodeLabel: () => {},
    addNodeMeta: () => {},
    removeNodeMeta: () => {},
    updateNodeAsset: () => {},
  }), []);

  const resetInteractionState = useCallback(() => {
    /* no-op for tests */
  }, []);

  const {
    beginAction: beginHistoryAction,
    undo,
    redo,
    canUndo,
    canRedo,
    peekUndo,
    peekRedo,
  } = useGraphHistory({
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
  });

  const updateInput = useCallback((value = 0.5) => {
    beginHistoryAction({ type: "update-input", summary: `Node 1 • Value` });
    setNodes((prev) =>
      prev.map((node) => {
        if (node.id !== "1") return node;
        const tpl = clone((node.data as any).template);
        tpl.inputs = tpl.inputs.map((pin: any, idx: number) => (idx === 0 ? { ...pin, value: [value] } : pin));
        return { ...node, data: { ...(node.data as any), template: tpl } } as TestNode;
      })
    );
  }, [beginHistoryAction]);

  const updateProperty = useCallback((value = 42) => {
    beginHistoryAction({ type: "update-property", summary: `Node 1 • Prop` });
    setNodes((prev) =>
      prev.map((node) => {
        if (node.id !== "1") return node;
        const tpl = clone((node.data as any).template);
        tpl.properties = tpl.properties.map((prop: any) => (prop.id === "prop" ? { ...prop, value } : prop));
        return { ...node, data: { ...(node.data as any), template: tpl } } as TestNode;
      })
    );
  }, [beginHistoryAction]);

  const updateAsset = useCallback((source = "asset://texture.png") => {
    beginHistoryAction({ type: "update-asset", summary: `Node 1 • Asset` });
    setNodes((prev) =>
      prev.map((node) => {
        if (node.id !== "1") return node;
        const nextData = { ...(node.data as any), asset: { id: "asset", source } };
        return { ...node, data: nextData } as TestNode;
      })
    );
  }, [beginHistoryAction]);

  const renameNode = useCallback((label = "Renamed") => {
    beginHistoryAction({ type: "rename-node", summary: `Node 1 → ${label}` });
    setNodes((prev) =>
      prev.map((node) => (node.id === "1" ? ({ ...node, data: { ...(node.data as any), label } } as TestNode) : node))
    );
  }, [beginHistoryAction]);

  const addMeta = useCallback((meta = "extra_meta") => {
    beginHistoryAction({ type: "add-meta", summary: `Node 1 • ${meta}` });
    setNodes((prev) =>
      prev.map((node) => {
        if (node.id !== "1") return node;
        const tpl = clone((node.data as any).template);
        const metaList: string[] = Array.isArray(tpl.meta) ? [...tpl.meta] : [];
        if (!metaList.includes(meta)) metaList.push(meta);
        tpl.meta = metaList;
        return { ...node, data: { ...(node.data as any), template: tpl } } as TestNode;
      })
    );
  }, [beginHistoryAction]);

  const removeMeta = useCallback((meta = "custom_meta") => {
    beginHistoryAction({ type: "remove-meta", summary: `Node 1 • ${meta}` });
    setNodes((prev) =>
      prev.map((node) => {
        if (node.id !== "1") return node;
        const tpl = clone((node.data as any).template);
        tpl.meta = Array.isArray(tpl.meta) ? tpl.meta.filter((entry: string) => entry !== meta) : [];
        return { ...node, data: { ...(node.data as any), template: tpl } } as TestNode;
      })
    );
  }, [beginHistoryAction]);

  const addNode = useCallback((label = "Node 3") => {
    beginHistoryAction({ type: "add-node", summary: `${label} • Add` });
    const newId = String(++idCounterRef.current);
    const newNode: TestNode = {
      id: newId,
      type: "graphNode",
      position: { x: 100, y: 200 },
      data: {
        label,
        template: { type: "test_node", inputs: [], outputs: [], properties: [], meta: [] },
      },
    } as TestNode;
    setNodes((prev) => [...prev, newNode]);
  }, [beginHistoryAction]);

  const deleteNode = useCallback((id = "2") => {
    beginHistoryAction({ type: "delete-node", summary: `Delete ${id}` });
    setNodes((prev) => prev.filter((node) => node.id !== id));
    setEdges((prev) => prev.filter((edge) => edge.source !== id && edge.target !== id));
  }, [beginHistoryAction]);

  const moveNode = useCallback((delta = { x: 10, y: 5 }) => {
    beginHistoryAction({ type: "move-node", summary: "Node 1 • Move" });
    setNodes((prev) =>
      prev.map((node) =>
        node.id === "1"
          ? ({
              ...node,
              position: {
                x: (node.position?.x ?? 0) + delta.x,
                y: (node.position?.y ?? 0) + delta.y,
              },
            } as TestNode)
          : node
      )
    );
  }, [beginHistoryAction]);

  const resizeNode = useCallback((size = { width: 320, height: 240 }) => {
    beginHistoryAction({ type: "resize-node", summary: "Node 1 • Resize" });
    setNodes((prev) =>
      prev.map((node) => {
        if (node.id !== "1") return node;
        const tpl = clone((node.data as any).template);
        const formatted = `editor_size:${size.width}x${size.height}`;
        const metaList: string[] = Array.isArray(tpl.meta) ? [...tpl.meta] : [];
        const idx = metaList.findIndex((entry) => typeof entry === "string" && entry.startsWith("editor_size:"));
        if (idx >= 0) metaList[idx] = formatted;
        else metaList.push(formatted);
        tpl.meta = metaList;
        return {
          ...node,
          data: { ...(node.data as any), template: tpl },
          style: { ...(node.style ?? {}), width: size.width, height: size.height },
        } as TestNode;
      })
    );
  }, [beginHistoryAction]);

  const connectNodes = useCallback(() => {
    beginHistoryAction({ type: "connect", summary: "Node 1 → Node 2" });
    setEdges([createEdge("e1-2", "1", "2")]);
  }, [beginHistoryAction]);

  const disconnectEdges = useCallback(() => {
    beginHistoryAction({ type: "disconnect", summary: "Disconnect" });
    setEdges([]);
  }, [beginHistoryAction]);

  const insertAdapter = useCallback(() => {
    beginHistoryAction({ type: "insert-adapter", summary: "Adapter" });
    const adapterId = String(++idCounterRef.current);
    const adapterNode: TestNode = {
      id: adapterId,
      type: "graphNode",
      position: { x: 100, y: 100 },
      data: {
        label: "Adapter",
        template: { type: "adapter", inputs: [], outputs: [], properties: [], meta: [] },
      },
    } as TestNode;
    setNodes((prev) => [...prev, adapterNode]);
    setEdges([
      createEdge(`e1-${adapterId}`, "1", adapterId),
      createEdge(`e${adapterId}-2`, adapterId, "2"),
    ]);
  }, [beginHistoryAction]);

  const groupNodes = useCallback(() => {
    beginHistoryAction({ type: "group-nodes", summary: "Group nodes" });
    const groupId = `g${++groupCounterRef.current}`;
    const groupNode: TestNode = {
      id: groupId,
      type: "group",
      position: { x: 50, y: 50 },
      data: {
        label: `Group ${groupCounterRef.current}`,
        template: { type: "group", inputs: [], outputs: [], properties: [], meta: [] },
      },
    } as TestNode;
    setNodes((prev) => [...prev, groupNode]);
  }, [beginHistoryAction]);

  const ungroupNodes = useCallback(() => {
    beginHistoryAction({ type: "ungroup-node", summary: "Ungroup" });
    setNodes((prev) => prev.filter((node) => node.type !== "group"));
  }, [beginHistoryAction]);

  const primeConnection = useCallback(() => {
    setEdges([createEdge("e1-2", "1", "2")]);
  }, []);

  const primeGroup = useCallback(() => {
    setNodes((prev) => {
      const exists = prev.some((node) => node.type === "group");
      if (exists) return prev;
      const groupNode: TestNode = {
        id: "g-prime",
        type: "group",
        position: { x: 50, y: 50 },
        data: {
          label: "Prime Group",
          template: { type: "group", inputs: [], outputs: [], properties: [], meta: [] },
        },
      } as TestNode;
      return [...prev, groupNode];
    });
  }, []);

  return {
    nodes,
    edges,
    updateInput,
    updateProperty,
    updateAsset,
    renameNode,
    addMeta,
    removeMeta,
    addNode,
    deleteNode,
    moveNode,
    resizeNode,
    connectNodes,
    disconnectEdges,
    insertAdapter,
    groupNodes,
    ungroupNodes,
    primeConnection,
    primeGroup,
    undo,
    redo,
    canUndo,
    canRedo,
    peekUndo,
    peekRedo,
  };
}

describe("useGraphHistory integration", () => {
  it("undo/redo update input", () => {
    const { result } = renderHook(() => useHistoryHarness());
    expect(((result.current.nodes[0].data as any).template.inputs[0].value)).toEqual([0]);
    act(() => result.current.updateInput(0.75));
    expect(((result.current.nodes[0].data as any).template.inputs[0].value)).toEqual([0.75]);
    expect(result.current.peekUndo?.type).toBe("update-input");
    act(() => result.current.undo());
    expect(((result.current.nodes[0].data as any).template.inputs[0].value)).toEqual([0]);
    expect(result.current.peekRedo?.type).toBe("update-input");
    act(() => result.current.redo());
    expect(((result.current.nodes[0].data as any).template.inputs[0].value)).toEqual([0.75]);
  });

  it("undo/redo update property", () => {
    const { result } = renderHook(() => useHistoryHarness());
    act(() => result.current.updateProperty(10));
    expect(((result.current.nodes[0].data as any).template.properties[0].value)).toBe(10);
    expect(result.current.peekUndo?.type).toBe("update-property");
    act(() => result.current.undo());
    expect(((result.current.nodes[0].data as any).template.properties[0].value)).toBe(1);
    act(() => result.current.redo());
    expect(((result.current.nodes[0].data as any).template.properties[0].value)).toBe(10);
  });

  it("undo/redo update asset", () => {
    const { result } = renderHook(() => useHistoryHarness());
    act(() => result.current.updateAsset("asset://wood.png"));
    expect(((result.current.nodes[0].data as any).asset).source).toBe("asset://wood.png");
    expect(result.current.peekUndo?.type).toBe("update-asset");
    act(() => result.current.undo());
    expect((result.current.nodes[0].data as any).asset).toBeUndefined();
    act(() => result.current.redo());
    expect(((result.current.nodes[0].data as any).asset).source).toBe("asset://wood.png");
  });

  it("undo/redo rename node", () => {
    const { result } = renderHook(() => useHistoryHarness());
    act(() => result.current.renameNode("Renamed"));
    expect((result.current.nodes[0].data as any).label).toBe("Renamed");
    expect(result.current.peekUndo?.type).toBe("rename-node");
    act(() => result.current.undo());
    expect((result.current.nodes[0].data as any).label).toBe("Node 1");
  });

  it("undo/redo add meta", () => {
    const { result } = renderHook(() => useHistoryHarness());
    act(() => result.current.addMeta("extra_meta"));
    expect(((result.current.nodes[0].data as any).template.meta)).toContain("extra_meta");
    expect(result.current.peekUndo?.type).toBe("add-meta");
    act(() => result.current.undo());
    expect(((result.current.nodes[0].data as any).template.meta)).not.toContain("extra_meta");
  });

  it("undo/redo remove meta", () => {
    const { result } = renderHook(() => useHistoryHarness());
    act(() => result.current.removeMeta("custom_meta"));
    expect(((result.current.nodes[0].data as any).template.meta)).not.toContain("custom_meta");
    expect(result.current.peekUndo?.type).toBe("remove-meta");
    act(() => result.current.undo());
    expect(((result.current.nodes[0].data as any).template.meta)).toContain("custom_meta");
  });

  it("undo/redo add node", () => {
    const { result } = renderHook(() => useHistoryHarness());
    act(() => result.current.addNode("Node 3"));
    expect(result.current.nodes.length).toBe(3);
    expect(result.current.peekUndo?.type).toBe("add-node");
    act(() => result.current.undo());
    expect(result.current.nodes.length).toBe(2);
  });

  it("undo/redo delete node", () => {
    const { result } = renderHook(() => useHistoryHarness());
    act(() => result.current.connectNodes());
    act(() => result.current.deleteNode("2"));
    expect(result.current.nodes.some((node) => node.id === "2")).toBe(false);
    expect(result.current.edges.length).toBe(0);
    expect(result.current.peekUndo?.type).toBe("delete-node");
    act(() => result.current.undo());
    expect(result.current.nodes.some((node) => node.id === "2")).toBe(true);
  });

  it("undo/redo move node", () => {
    const { result } = renderHook(() => useHistoryHarness());
    act(() => result.current.moveNode({ x: 15, y: -5 }));
    expect(result.current.nodes[0].position).toEqual({ x: 15, y: -5 });
    expect(result.current.peekUndo?.type).toBe("move-node");
    act(() => result.current.undo());
    expect(result.current.nodes[0].position).toEqual({ x: 0, y: 0 });
  });

  it("undo/redo resize node", () => {
    const { result } = renderHook(() => useHistoryHarness());
    act(() => result.current.resizeNode({ width: 400, height: 260 }));
    const meta = (result.current.nodes[0].data as any).template.meta;
    expect(meta).toContain("editor_size:400x260");
    expect((result.current.nodes[0].style as any).width).toBe(400);
    expect(result.current.peekUndo?.type).toBe("resize-node");
    act(() => result.current.undo());
    const metaAfterUndo = (result.current.nodes[0].data as any).template.meta;
    expect(metaAfterUndo).toContain("editor_size:200x120");
  });

  it("undo/redo connect nodes", () => {
    const { result } = renderHook(() => useHistoryHarness());
    act(() => result.current.connectNodes());
    expect(result.current.edges.length).toBe(1);
    expect(result.current.peekUndo?.type).toBe("connect");
    act(() => result.current.undo());
    expect(result.current.edges.length).toBe(0);
  });

  it("undo/redo disconnect edges", () => {
    const { result } = renderHook(() => useHistoryHarness());
    act(() => result.current.primeConnection());
    expect(result.current.edges.length).toBe(1);
    act(() => result.current.disconnectEdges());
    expect(result.current.edges.length).toBe(0);
    expect(result.current.peekUndo?.type).toBe("disconnect");
    act(() => result.current.undo());
    expect(result.current.edges.length).toBe(1);
  });

  it("undo/redo insert adapter", () => {
    const { result } = renderHook(() => useHistoryHarness());
    act(() => result.current.insertAdapter());
    expect(result.current.nodes.length).toBe(3);
    expect(result.current.edges.length).toBe(2);
    expect(result.current.peekUndo?.type).toBe("insert-adapter");
    act(() => result.current.undo());
    expect(result.current.nodes.length).toBe(2);
    expect(result.current.edges.length).toBe(0);
  });

  it("undo/redo group nodes", () => {
    const { result } = renderHook(() => useHistoryHarness());
    act(() => result.current.groupNodes());
    expect(result.current.nodes.some((node) => node.type === "group")).toBe(true);
    expect(result.current.peekUndo?.type).toBe("group-nodes");
    act(() => result.current.undo());
    expect(result.current.nodes.some((node) => node.type === "group")).toBe(false);
  });

  it("undo/redo ungroup nodes", () => {
    const { result } = renderHook(() => useHistoryHarness());
    act(() => result.current.primeGroup());
    expect(result.current.nodes.some((node) => node.type === "group")).toBe(true);
    act(() => result.current.ungroupNodes());
    expect(result.current.nodes.some((node) => node.type === "group")).toBe(false);
    expect(result.current.peekUndo?.type).toBe("ungroup-node");
    act(() => result.current.undo());
    expect(result.current.nodes.some((node) => node.type === "group")).toBe(true);
  });
});
