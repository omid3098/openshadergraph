import "./index.css";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  getNodesBounds,
  Position,
  SelectionMode,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { GraphContextMenu, type ContextKind } from "./components/GraphContextMenu";
import { fetchNodePalette, fetchNodeTemplate, type NodePalette, type NodePaletteItem, type NodeTemplate } from "./core/schema/nodes";
import { GraphDataPanel } from "./components/GraphDataPanel";
import { useReactFlow } from "@xyflow/react";
import { GraphNode } from "./components/GraphNode";

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
  const [graphName] = useState<string>("UntitledGraph");
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
      .catch((err) => console.warn("Failed to load node palette", err));
    return () => ctrl.abort();
  }, []);

  const graphData = useMemo(() => {
    // Root graph follows data/node.json shape
    const root: any = {
      type: "",
      name: graphName,
      meta: [],
      nodes: [] as any[],
      inputs: [],
      outputs: [],
    };

    // Build node JSONs from stored templates on nodes, preserving hierarchy via parentId
    const map: Record<string, any> = {};
    const parentMap: Record<string, string | undefined> = {};
    for (const n of nodes) {
      const t = (n.data as any)?.template as NodeTemplate | undefined;
      const base = t
        ? JSON.parse(JSON.stringify(t))
        : { type: (n.data as any)?.type ?? "", name: (n.data as any)?.label ?? "", meta: [], nodes: [], inputs: [], outputs: [] };
      // Update id/position from current RF state
      const idNum = Number(n.id);
      if (Number.isFinite(idNum)) base.id = idNum;
      base.position = [Math.round(n.position.x), Math.round(n.position.y)];
      // Ensure arrays exist
      base.meta ??= [];
      base.nodes ??= [];
      base.inputs ??= [];
      base.outputs ??= [];
      // Strip redundant meta like current_pintype from instance view
      base.meta = base.meta.filter((m: any) => !(m && typeof m === "object" && "current_pintype" in m));
      map[n.id] = base;
      parentMap[n.id] = (n as any).parentId;
    }
    // Attach children to parents
    for (const id of Object.keys(map)) {
      const parentId = parentMap[id];
      if (parentId && map[parentId]) {
        map[parentId].nodes.push(map[id]);
      } else {
        root.nodes.push(map[id]);
      }
    }

    // Helpers
    const parseRef = (v: any): { nodeId: string; pinId: number } | null => {
      if (typeof v !== "string") return null;
      const m = v.match(/^\.\.\/(\d+)\/(\d+)$/);
      if (!m) return null;
      return { nodeId: m[1], pinId: Number(m[2]) };
    };
    const inferScalarFromLiteral = (val: any): string | undefined => {
      if (Array.isArray(val) && val.every((n) => typeof n === "number")) {
        const len = val.length;
        if (len === 1) return "float";
        if (len === 2) return "float2";
        if (len === 3) return "float3";
        if (len === 4) return "float4";
      }
      return undefined;
    };

    // Encode edges into both input and output pin values per spec.
    // Input value:  ../<fromNodeId>/<fromPinId>
    // Output value: ../<toNodeId>/<toPinId>
    for (const e of edges) {
      const src = map[e.source];
      const dst = map[e.target];
      if (!src || !dst) continue;
      const tgtId = (() => {
        if (e.targetHandle) {
          const m = String(e.targetHandle).match(/(in|input)-(?<id>\d+)/);
          if (m?.groups?.id) return Number(m.groups.id);
        }
        // fallback: first input id or index 0
        return typeof dst.inputs?.[0]?.id === "number" ? dst.inputs[0].id : 0;
      })();
      const srcOutId = (() => {
        if (e.sourceHandle) {
          const m = String(e.sourceHandle).match(/(out|output)-(?<id>\d+)/);
          if (m?.groups?.id) return Number(m.groups.id);
        }
        return typeof src.outputs?.[0]?.id === "number" ? src.outputs[0].id : 0;
      })();
      // Set input side reference
      const dstPinIndex = dst.inputs.findIndex((p: any) => p.id === tgtId);
      const inIdx = dstPinIndex >= 0 ? dstPinIndex : 0;
      if (dst.inputs?.[inIdx]) {
        dst.inputs[inIdx].value = `../${Number(e.source)}/${srcOutId}`;
      }
      // Set output side reference
      const srcOutIndex = src.outputs.findIndex((p: any) => p.id === srcOutId);
      const outIdx = srcOutIndex >= 0 ? srcOutIndex : 0;
      if (src.outputs?.[outIdx]) {
        src.outputs[outIdx].value = `../${Number(e.target)}/${tgtId}`;
      }
    }

    // Resolve polymorphic pin types by inspecting connections and defaults
    const getOutputType = (node: any, outId: number): string | undefined => {
      const out = (node.outputs ?? []).find((p: any) => (typeof p.id === "number" ? p.id === outId : false)) ?? node.outputs?.[0];
      if (!out) return undefined;
      const t = out.type;
      if (typeof t === "string") return t;
      if (Array.isArray(t) && t.length) return t[0];
      return undefined;
    };
    const resolveNodeTypes = () => {
      for (const key of Object.keys(map)) {
        const node = map[key];
        // Resolve inputs
        for (const pin of node.inputs) {
          const t = pin.type;
          if (Array.isArray(t)) {
            let resolved: string | undefined;
            // Prefer source connection type
            const ref = parseRef(pin.value);
            if (ref) {
              const src = map[ref.nodeId];
              if (src) {
                const st = getOutputType(src, ref.pinId);
                if (st && t.includes(st)) resolved = st;
              }
            }
            // Fallback to literal default
            if (!resolved) resolved = inferScalarFromLiteral(pin.value);
            // Final fallback: first declared type
            if (!resolved && t.length) resolved = t[0];
            if (resolved) pin.type = resolved;
          }
        }
        // Resolve outputs to match first resolved input type when polymorphic
        const firstResolvedInput = node.inputs.find((p: any) => typeof p.type === "string")?.type;
        for (const pin of node.outputs) {
          const t = pin.type;
          if (Array.isArray(t)) {
            pin.type = (firstResolvedInput && t.includes(firstResolvedInput)) ? firstResolvedInput : t[0];
          }
        }
      }
    };
    resolveNodeTypes();

    return root;
  }, [nodes, edges, graphName]);

  // Visible graph based on current viewPath (root vs. inside a group)
  const currentParentId = viewPath.length ? viewPath[viewPath.length - 1] : undefined;
  const visibleNodes = useMemo(() => {
    return nodes.filter((n) => {
      const pid = (n as any).parentId as string | undefined;
      return (pid ?? undefined) === (currentParentId ?? undefined);
    });
  }, [nodes, currentParentId]);
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);
  const visibleEdges = useMemo(() => {
    return edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));
  }, [edges, visibleNodeIds]);

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
    // Prepare node JSON for graph view
    const graphNode: NodeTemplate = template
      ? {
          ...template,
          id: Number(nextId),
          position: [Math.round(pos.x), Math.round(pos.y)],
        }
      : {
          id: Number(nextId),
          type: item.type,
          name: item.name,
          meta: [],
          position: [Math.round(pos.x), Math.round(pos.y)],
          nodes: [],
          inputs: [],
          outputs: [],
        };

    setNodes((prev) => [
      ...prev,
      {
        id: nextId,
        type: "graphNode",
        position: pos,
        data: {
          label: graphNode.name ?? item.name,
          type: graphNode.type,
          templatePath: item.path,
          category: item.category,
          template: graphNode,
        },
        ...nodeDefaults,
      },
    ]);
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
          // Drill into group nodes via double click
          if ((node.data as any)?.type === "group") {
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
      <GraphDataPanel data={graphData} />
      {/* Breadcrumbs for nested view */}
      <div className="absolute left-2 top-2 z-10 flex items-center gap-1 text-xs bg-background/80 backdrop-blur px-2 py-1 rounded-md border">
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
