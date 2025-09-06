import "./index.css";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Position,
  SelectionMode,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GraphContextMenu, type ContextKind } from "./components/GraphContextMenu";
import { fetchNodePalette, fetchNodeTemplate, type NodePalette, type NodePaletteItem, type NodeTemplate } from "./core/schema/nodes";
// Panels are now hosted inside a unified dock overlay
import { useReactFlow } from "@xyflow/react";
import { GraphNode } from "./components/GraphNode";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { buildRFNodeFromTemplate } from "./core/ui/nodeFactory";
import { isAbortError } from "./lib/errors";
import { prepareVisibleNodes } from "./core/ui/visible";
import { buildGraphData } from "./core/ui/graphData";
import { PanelsOverlay } from "./ui/panels/PanelsOverlay";

const nodeDefaults = {
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
};

const initialNodes: Node[] = [];

const initialEdges: Edge[] = [];

export function App() {
  const rf = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [palette, setPalette] = useState<NodePalette | null>(null);
  const idCounter = useRef(0);
  const [viewPath, setViewPath] = useState<string[]>([]); // breadcrumb of nested groups
  const [graphName, setGraphName] = useState<string>("UntitledGraph");
  const [examples, setExamples] = useState<Array<{ key: string; label: string }>>([]);
  const [selectedExample, setSelectedExample] = useState<string>("");
  const [menu, setMenu] = useState<{
    open: boolean;
    kind: ContextKind;
    x: number;
    y: number;
    targetId?: string;
  }>({ open: false, kind: "background", x: 0, y: 0 });

  const onConnect = (params: Connection) =>
    setEdges((eds) => addEdge(params, eds));

  useEffect(() => {
    const ctrl = new AbortController();
    fetchNodePalette(ctrl.signal)
      .then(setPalette)
      .catch((err: any) => {
        if (isAbortError(err)) return;
        console.warn("Failed to load node palette", err);
      });
    return () => ctrl.abort();
  }, []);

  const graphData = useMemo(() => buildGraphData(nodes as any, edges as any, graphName), [nodes, edges, graphName]);

  // Visible graph based on current viewPath (root vs. inside a group)
  const currentParentId = viewPath.length ? viewPath[viewPath.length - 1] : undefined;
  const visibleNodes = useMemo(() => {
    return prepareVisibleNodes(nodes as any, currentParentId) as any;
  }, [nodes, currentParentId]);
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);
  const visibleEdges = useMemo(() => {
    return edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));
  }, [edges, visibleNodeIds]);

  // Centralized updater to modify node template inputs while preserving parentId
  const updateNodeInputValue = useCallback((id: string, pinId: number, next: number[] | string | number) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        const tpl = (n.data as any)?.template;
        if (!tpl || !Array.isArray(tpl.inputs)) return n;
        const idx = tpl.inputs.findIndex((p: any, i: number) => (typeof p.id === "number" ? p.id === pinId : i === pinId));
        if (idx < 0) return n;
        const normalized = Array.isArray(next) ? next : typeof next === "number" ? [next] : next;
        const nextTpl = { ...tpl, inputs: tpl.inputs.map((p: any, i: number) => (i === idx ? { ...p, value: normalized } : p)) };
        return { ...n, data: { ...(n.data as any), template: nextTpl } } as any;
      })
    );
  }, [setNodes]);

  // Helpers to load an example graph JSON into the canvas
  type GNode = {
    id: number;
    type: string;
    name?: string;
    meta?: any[];
    position?: [number, number];
    nodes?: GNode[];
    inputs?: Array<{ id: number; name: string; type: any; value?: any }>;
    outputs?: Array<{ id: number; name: string; type: any }>;
  };
  const loadExampleGraph = useCallback(async (ex: { key: string; label: string }) => {
    try {
      const url = new URL("/api/example-graphs", location.origin);
      url.searchParams.set("name", ex.key);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const graph = data.graph as GNode;

      // Flatten graph nodes and build ReactFlow nodes/edges
      const createdNodes: Node[] = [];
      const createdEdges: Edge[] = [];
      const depthX = 240; // x step per depth
      const rowY = 120; // y step per item
      const baseX = 80;
      const baseY = 40;
      const perParentRow: Record<string, number> = {};
      const all: Record<string, GNode> = {};

      const walk = (n: GNode, parentId?: string, depth = 0) => {
        const idStr = String(n.id);
        all[idStr] = n;
        const row = perParentRow[parentId ?? "root"] ?? 0;
        const pos = n.position
          ? { x: n.position[0], y: n.position[1] }
          : { x: baseX + depth * depthX, y: baseY + row * rowY };
        perParentRow[parentId ?? "root"] = row + 1;
        createdNodes.push({
          id: idStr,
          type: "graphNode",
          position: pos,
          data: {
            label: n.name ?? n.type,
            type: n.type,
            template: {
              id: n.id,
              type: n.type,
              name: n.name,
              meta: n.meta ?? [],
              position: n.position ?? [pos.x, pos.y],
              nodes: n.nodes ?? [],
              inputs: n.inputs ?? [],
              outputs: n.outputs ?? [],
            },
          },
          ...(parentId ? { parentId } : {}),
          ...nodeDefaults,
        } as any);
        // children
        for (const child of n.nodes ?? []) {
          walk(child, idStr, depth + 1);
        }
      };
      walk(graph, undefined, 0);

      // Build edges from input pin refs ../<nodeId>/<pinId>
      const refRe = /^\.\.\/(\d+)\/(\d+)$/;
      for (const gid of Object.keys(all)) {
        const gn = all[gid];
        for (const pin of gn.inputs ?? []) {
          if (typeof pin.value !== "string") continue;
          const m = pin.value.match(refRe);
          if (!m) continue;
          const fromId = m[1];
          const fromPin = Number(m[2]);
          const toId = gid;
          const toPin = pin.id;
          createdEdges.push({
            id: `e${fromId}-${toId}-${fromPin}-${toPin}`,
            source: String(fromId),
            target: String(toId),
            sourceHandle: `out-${fromPin}`,
            targetHandle: `in-${toPin}`,
          });
        }
      }

      // Compute idCounter from max id
      const maxId = Math.max(...Object.keys(all).map((s) => Number(s)));
      idCounter.current = maxId;

      // Choose default view: fragment_pass if present, else vertex_pass, else surface
      const surfaceId = String(graph.id);
      const fragmentPass = (graph.nodes ?? []).find((n) => n.type === "fragment_pass");
      const vertexPass = (graph.nodes ?? []).find((n) => n.type === "vertex_pass");
      const defaultPath = fragmentPass
        ? [surfaceId, String(fragmentPass.id)]
        : vertexPass
          ? [surfaceId, String(vertexPass.id)]
          : [surfaceId];

      // Attach update function to node data for safe edits from GraphNode
      setNodes(createdNodes.map((n) => ({ ...n, data: { ...(n.data as any), updateInputValue: updateNodeInputValue } })) as any);
      setEdges(createdEdges);
      setGraphName(ex.label ?? "UntitledGraph");
      setSelectedExample(ex.key);
      setViewPath(defaultPath);
    } catch (err) {
      console.warn("Failed to load example graph", ex, err);
    }
  }, [setNodes, setEdges, setGraphName, setViewPath, updateNodeInputValue]);

  // Fetch example graphs and load the first by default
  useEffect(() => {
    const abort = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/example-graphs", { signal: abort.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        const list: Array<{ key: string; label: string }> = Array.isArray(data.examples) ? data.examples : [];
        setExamples(list);
        if (list.length) {
          // Default: load the first example
          await loadExampleGraph(list[0]);
        }
      } catch (err: any) {
        if (isAbortError(err)) return;
        console.warn("Failed to load example graphs", err);
      }
    })();
    return () => abort.abort();
  }, [loadExampleGraph]);

  const addNodeAt = async (opts: { item: NodePaletteItem; x: number; y: number }) => {
    const { item, x, y } = opts;
    const nextId = String(++idCounter.current);
    const pos = rf.screenToFlowPosition({ x, y });
    let template: NodeTemplate | undefined;
    try {
      template = await fetchNodeTemplate(item.path);
    } catch (err) {
      console.warn("Failed to fetch node template", item.path, err);
    }
    const rfNode = buildRFNodeFromTemplate({
      id: nextId,
      item,
      template,
      position: pos,
      parentId: currentParentId,
      nodeDefaults,
    });
    // Inject updater on the new node
    (rfNode as any).data = { ...(rfNode as any).data, updateInputValue: updateNodeInputValue };
    setNodes((prev) => [...prev, rfNode as any]);
  };

  const deleteNodeById = (id: string) => {
    const node = rf.getNode(id);
    if (node && (node as any).deletable === false) return; // protect mandatory IO nodes
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
  };

  // Group selected nodes into a new container node with dynamic I/O
  const groupSelected = () => {
    const selected = rf.getNodes().filter((n) => n.selected);
    if (!selected.length) return;
    const selectedIds = new Set(selected.map((n) => n.id));
    const idGen = () => String(++idCounter.current);
    const res = utilGroupSelected(nodes as any, edges as any, selectedIds, idGen);
    setNodes(res.nodes as any);
    setEdges(res.edges as any);
  };

  // Ungroup a group node: move children out, restore external edges, remove group + IO nodes
  const ungroupGroup = (groupId: string) => {
    const res = utilUngroupGroup(nodes as any, edges as any, groupId);
    setNodes(res.nodes as any);
    setEdges(res.edges as any);
    setViewPath((p) => (p.length && p[p.length - 1] === groupId ? p.slice(0, -1) : p));
  };

  return (
    <div className="w-screen h-screen relative">
      <ReactFlow
        nodes={visibleNodes}
        edges={visibleEdges}
        nodeTypes={{ graphNode: GraphNode }}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        panOnDrag={[1]}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        onNodeDoubleClick={(e, node) => {
          // Drill into container nodes via double click
          const t = (node.data as any)?.type;
          if (t === "group" || t === "surface" || t === "vertex_pass" || t === "fragment_pass") {
            setViewPath((p) => [...p, node.id]);
          }
        }}
        onPaneClick={() => {
          // Close context menu when clicking the background pane
          setMenu((m) => (m.open ? { ...m, open: false } : m));
        }}
        onPaneContextMenu={(e) => {
          e.preventDefault();
          setMenu({ open: true, kind: "background", x: e.clientX, y: e.clientY });
        }}
        onSelectionContextMenu={(e) => {
          e.preventDefault();
          setMenu({ open: true, kind: "selection", x: e.clientX, y: e.clientY });
        }}
        onNodeContextMenu={(e, node) => {
          e.preventDefault();
          setMenu({ open: true, kind: "node", x: e.clientX, y: e.clientY, targetId: node.id });
        }}
        onEdgeContextMenu={(e, edge) => {
          e.preventDefault();
          setMenu({ open: true, kind: "edge", x: e.clientX, y: e.clientY, targetId: edge.id });
        }}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
      <PanelsOverlay graph={graphData} />
      {/* Example selector + Breadcrumbs for nested view */}
      <div className="absolute left-2 top-2 z-10 flex items-center gap-2 text-xs bg-background/80 backdrop-blur px-2 py-1 rounded-md border">
        <div className="min-w-[200px]">
          <Select
            value={selectedExample}
            onValueChange={(v) => {
              const ex = examples.find((e) => e.key === v);
              if (ex) loadExampleGraph(ex);
            }}
          >
            <SelectTrigger aria-label="Example Graph">
              <SelectValue placeholder="Select example graph" />
            </SelectTrigger>
            <SelectContent>
              {examples.map((e) => (
                <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-muted-foreground">•</span>
        <button className="hover:underline" onClick={() => setViewPath([])}>{graphName}</button>
        {viewPath.map((id, i) => {
          const n = nodes.find((nn) => nn.id === id);
          const isLast = i === viewPath.length - 1;
          return (
            <span key={id} className="flex items-center gap-1">
              <span>/</span>
              {isLast ? (
                <span className="font-medium">{(n?.data as any)?.label ?? (n?.data as any)?.type ?? id}</span>
              ) : (
                <button className="hover:underline" onClick={() => setViewPath(viewPath.slice(0, i + 1))}>{(n?.data as any)?.label ?? (n?.data as any)?.type ?? id}</button>
              )}
            </span>
          );
        })}
      </div>
      <GraphContextMenu
        open={menu.open}
        kind={menu.kind}
        x={menu.x}
        y={menu.y}
        targetId={menu.targetId}
        palette={palette ?? undefined}
        selectedCount={rf.getNodes().filter((n) => n.selected).length}
        onGroupSelected={() => {
          groupSelected();
          setMenu((m) => ({ ...m, open: false }));
        }}
        canUngroup={(() => {
          if (!menu.targetId) return false;
          const n = rf.getNode(menu.targetId);
          return (n?.data as any)?.type === "group";
        })()}
        onUngroupNode={(id) => {
          ungroupGroup(id);
          setMenu((m) => ({ ...m, open: false }));
        }}
        onAddNode={async (item) => {
          if (!item) return;
          await addNodeAt({ item, x: menu.x, y: menu.y });
          setMenu((m) => ({ ...m, open: false }));
        }}
        onDeleteNode={(id) => {
          if (!id) return;
          deleteNodeById(id);
          setMenu((m) => ({ ...m, open: false }));
        }}
        onClose={() => setMenu((m) => ({ ...m, open: false }))}
      />
    </div>
  );
}

export default App;
import { groupSelected as utilGroupSelected, ungroupGroup as utilUngroupGroup } from "./core/graph/grouping";
