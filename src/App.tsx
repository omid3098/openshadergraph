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
import { attachNodeUpdateApi, attachNodesUpdateApi, type NodeUpdaterApi } from "./core/ui/nodeUpdaters";
import { GraphStateProvider } from "./core/ui/GraphStateContext";
import { isAbortError } from "./lib/errors";
import { prepareVisibleNodes } from "./core/ui/visible";
import { buildGraphData } from "./core/ui/graphData";
import { PanelsOverlay } from "./ui/panels/PanelsOverlay";
import { restoreInputsToDefaults } from "./core/ui/resetInputs";
import { ASSET_DRAG_MIME, parseAssetDragPayload } from "./core/assets/kind";
import { AppShell } from "./ui/layout/AppShell";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "./components/ui/breadcrumb";
import { Menubar, MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem, MenubarSeparator, MenubarSub, MenubarSubTrigger, MenubarSubContent } from "./components/ui/menubar";
import { FileText, LayoutDashboard, BookOpen } from "lucide-react";

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

  const paletteByType = useMemo(() => {
    const map = new Map<string, NodePaletteItem>();
    if (palette) {
      for (const item of palette.flat ?? []) {
        map.set(item.type, item);
      }
    }
    return map;
  }, [palette]);

  const templateCache = useRef(new Map<string, NodeTemplate>());

  const loadTemplateDefaults = useCallback(
    async (type: string): Promise<NodeTemplate | undefined> => {
      if (!type) return undefined;
      if (templateCache.current.has(type)) return templateCache.current.get(type);
      const item = paletteByType.get(type);
      if (!item) return undefined;
      try {
        const tpl = await fetchNodeTemplate(item.path);
        templateCache.current.set(type, tpl);
        return tpl;
      } catch (err) {
        console.warn("Failed to fetch node defaults for", type, err);
        return undefined;
      }
    },
    [paletteByType]
  );

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

  const updateNodePropertyValue = useCallback((id: string, propId: string, next: unknown) => {
    if (!propId) return;
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        const tpl = (n.data as any)?.template ?? {};
        const props: any[] = Array.isArray((tpl as any).properties) ? ([...(tpl as any).properties] as any[]) : [];
        const nextProps = props.map((prop) =>
          prop && typeof prop === "object" && prop.id === propId ? { ...prop, value: next } : prop
        );
        return { ...n, data: { ...(n.data as any), template: { ...tpl, properties: nextProps } } } as any;
      })
    );
  }, [setNodes]);

  // Centralized updaters for node label and metas to preserve parentId
  const updateNodeLabel = useCallback((id: string, label: string) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        const tpl = (n.data as any)?.template;
        const nextTpl = tpl ? { ...tpl, name: label } : tpl;
        return { ...n, data: { ...(n.data as any), label, template: nextTpl } } as any;
      })
    );
  }, [setNodes]);

  const addNodeMeta = useCallback((id: string, metaKey: string) => {
    if (!metaKey) return;
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        const tpl = (n.data as any)?.template ?? {};
        const meta: string[] = Array.isArray((tpl as any).meta) ? ([...(tpl as any).meta] as string[]) : [];
        if (!meta.includes(metaKey)) meta.push(metaKey);
        return { ...n, data: { ...(n.data as any), template: { ...tpl, meta } } } as any;
      })
    );
  }, [setNodes]);

  const removeNodeMeta = useCallback((id: string, metaKey: string) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        const tpl = (n.data as any)?.template ?? {};
        const meta: string[] = (Array.isArray((tpl as any).meta) ? (tpl as any).meta : []).filter((m: any) => m !== metaKey);
        return { ...n, data: { ...(n.data as any), template: { ...tpl, meta } } } as any;
      })
    );
  }, [setNodes]);

  const nodeUpdaterApi = useMemo<NodeUpdaterApi>(
    () => ({
      updateInputValue: updateNodeInputValue,
      updatePropertyValue: updateNodePropertyValue,
      updateNodeLabel,
      addNodeMeta,
      removeNodeMeta,
    }),
    [updateNodeInputValue, updateNodePropertyValue, updateNodeLabel, addNodeMeta, removeNodeMeta]
  );

  const nodesById = useMemo(() => {
    const map = new Map<string, Node>();
    for (const node of nodes) map.set(node.id, node);
    return map;
  }, [nodes]);

  const graphStateValue = useMemo(
    () => ({ nodesById, nodeUpdaterApi }),
    [nodesById, nodeUpdaterApi]
  );

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
    properties?: any[];
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
        const meta = Array.isArray(n.meta) ? [...n.meta] : [];
        const properties = Array.isArray(n.properties) ? JSON.parse(JSON.stringify(n.properties)) : [];
        const assetMeta = meta.find((m: any) => typeof m === "string" && m.startsWith("asset:"));
        if (assetMeta) {
          const source = assetMeta.slice("asset:".length).trim();
          if (source) {
            let assigned = false;
            for (let i = 0; i < properties.length; i++) {
              const prop = properties[i];
              if (prop && typeof prop === "object" && (prop.id === "source" || prop.id === "texture_source")) {
                properties[i] = { ...prop, value: source };
                assigned = true;
                break;
              }
            }
            if (!assigned) {
              properties.push({ id: "source", type: "asset", label: "Texture Asset", assetKind: "texture", value: source });
            }
          }
        }
        if (n.type === "fragment_output") {
          const shadingMeta = meta.find((m: any) => typeof m === "string" && m.startsWith("shading_"));
          if (shadingMeta) {
            const slug = shadingMeta.slice("shading_".length).trim();
            const map: Record<string, string> = { pbr: "pbr", unlit: "unlit", toon: "toon" };
            const value = map[slug] ?? undefined;
            if (value) {
              let assigned = false;
              for (let i = 0; i < properties.length; i++) {
                const prop = properties[i];
                if (prop && typeof prop === "object" && prop.id === "shading_model") {
                  properties[i] = { ...prop, value };
                  assigned = true;
                  break;
                }
              }
              if (!assigned) {
                properties.push({ id: "shading_model", type: "enum", value });
              }
            }
          }
        }
        const filteredMeta = meta.filter((m: any) => {
          if (typeof m !== "string") return true;
          if (m.startsWith("asset:")) return false;
          if (m.startsWith("shading_")) return false;
          return true;
        });

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
              meta: filteredMeta,
              position: n.position ?? [pos.x, pos.y],
              nodes: n.nodes ?? [],
              inputs: n.inputs ?? [],
              outputs: n.outputs ?? [],
              properties,
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
      setNodes(attachNodesUpdateApi(createdNodes as any, nodeUpdaterApi) as any);
      setEdges(createdEdges);
      setGraphName(ex.label ?? "UntitledGraph");
      setSelectedExample(ex.key);
      setViewPath(defaultPath);
    } catch (err) {
      console.warn("Failed to load example graph", ex, err);
    }
  }, [setNodes, setEdges, setGraphName, setViewPath, nodeUpdaterApi]);

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
    const decoratedNode = attachNodeUpdateApi(rfNode as any, nodeUpdaterApi);
    setNodes((prev) => [...prev, decoratedNode as any]);
  };

  const deleteNodeById = useCallback(
    async (id: string) => {
      const node = rf.getNode(id);
      if (node && (node as any).deletable === false) return; // protect mandatory IO nodes
      const removed = new Set<string>([id]);
      const dependents = rf
        .getNodes()
        .filter((n) => n.id !== id)
        .filter((n) => {
          const tpl: any = (n.data as any)?.template;
          if (!tpl || !Array.isArray(tpl.inputs)) return false;
          return tpl.inputs.some((pin: any) => {
            if (typeof pin?.value !== "string") return false;
            const m = pin.value.match(/^\.\.\/(\d+)\/(\d+)$/);
            return !!(m && removed.has(m[1]));
          });
        });

      const defaultsByNodeId = new Map<string, NodeTemplate>();
      for (const dep of dependents) {
        const depType = ((dep.data as any)?.template?.type ?? (dep.data as any)?.type) as string | undefined;
        if (!depType) continue;
        const tpl = await loadTemplateDefaults(depType);
        if (tpl) defaultsByNodeId.set(dep.id, tpl);
      }

      setNodes((ns) =>
        attachNodesUpdateApi(
          ns
            .filter((n) => n.id !== id)
            .map((n) => {
              const defaults = defaultsByNodeId.get(n.id);
              if (!defaults) return n;
              const tpl: any = (n.data as any)?.template;
              if (!tpl || !Array.isArray(tpl.inputs)) return n;
              const { changed, inputs } = restoreInputsToDefaults(tpl.inputs, defaults.inputs, removed);
              if (!changed) return n;
              const nextTpl = { ...tpl, inputs };
              return { ...n, data: { ...(n.data as any), template: nextTpl } } as any;
            }),
          nodeUpdaterApi
        )
      );
      setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
    },
    [loadTemplateDefaults, nodeUpdaterApi, rf, setEdges, setNodes]
  );

  // Group selected nodes into a new container node with dynamic I/O
  const groupSelected = () => {
    const selected = rf.getNodes().filter((n) => n.selected);
    if (!selected.length) return;
    const selectedIds = new Set(selected.map((n) => n.id));
    const idGen = () => String(++idCounter.current);
    const res = utilGroupSelected(nodes as any, edges as any, selectedIds, idGen);
    setNodes(attachNodesUpdateApi(res.nodes as any, nodeUpdaterApi) as any);
    setEdges(res.edges as any);
  };

  // Ungroup a group node: move children out, restore external edges, remove group + IO nodes
  const ungroupGroup = (groupId: string) => {
    const res = utilUngroupGroup(nodes as any, edges as any, groupId);
    setNodes(attachNodesUpdateApi(res.nodes as any, nodeUpdaterApi) as any);
    setEdges(res.edges as any);
    setViewPath((p) => (p.length && p[p.length - 1] === groupId ? p.slice(0, -1) : p));
  };

  const handleAssetDrop = useCallback(async (event: React.DragEvent) => {
    if (!event.dataTransfer?.types.includes(ASSET_DRAG_MIME)) return;
    event.preventDefault();
    const raw = event.dataTransfer.getData(ASSET_DRAG_MIME);
    const payload = parseAssetDragPayload(raw);
    if (!payload) return;
    if (payload.type !== "texture") return;
    const item = paletteByType.get("texture");
    if (!item) return;
    const { clientX, clientY } = event;
        const projected = rf.screenToFlowPosition({ x: clientX, y: clientY });
    const parentNode = currentParentId ? rf.getNode(currentParentId) : undefined;
    const position = parentNode
      ? { x: projected.x - parentNode.position.x, y: projected.y - parentNode.position.y }
      : projected;
    const defaults = await loadTemplateDefaults("texture");
    const template = defaults ? JSON.parse(JSON.stringify(defaults)) : undefined;
    const nextId = String(++idCounter.current);
    const baseNode = buildRFNodeFromTemplate({
      id: nextId,
      item,
      template,
      position,
      parentId: currentParentId,
    });
    const tpl = ((baseNode.data as any)?.template ?? {}) as any;
    const props: any[] = Array.isArray(tpl.properties) ? [...tpl.properties] : [];
    let assigned = false;
    const nextProps = props.map((prop) => {
      if (prop && typeof prop === "object" && (prop.id === "source" || prop.id === "texture_source")) {
        assigned = true;
        return { ...prop, value: payload.source };
      }
      return prop;
    });
    if (!assigned) {
      nextProps.push({ id: "source", type: "asset", label: "Texture", value: payload.source });
    }
    const node = {
      ...baseNode,
      data: {
        ...(baseNode.data as any),
        label: payload.label || (baseNode.data as any)?.label || item.name,
        asset: payload,
        template: { ...tpl, name: payload.label || tpl.name, properties: nextProps },
      },
    } as any;
    const decoratedNode = attachNodeUpdateApi(node as any, nodeUpdaterApi);
    setNodes((prev) => [...prev, decoratedNode]);
    setMenu((m) => (m.open ? { ...m, open: false } : m));
  }, [paletteByType, rf, currentParentId, loadTemplateDefaults, nodeUpdaterApi, setNodes]);

  const Header = (
    <div className="w-full flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-xs">
        <Menubar>
          <MenubarMenu>
            <MenubarTrigger>File</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>New</MenubarItem>
              <MenubarItem>Open…</MenubarItem>
              <MenubarSeparator />
              <MenubarItem>Save</MenubarItem>
              <MenubarItem>Save As…</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>View</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>Properties</MenubarItem>
              <MenubarItem>Compile</MenubarItem>
              <MenubarItem>Graph Data</MenubarItem>
              <MenubarItem>Assets</MenubarItem>
              <MenubarItem>Preview</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>Examples</MenubarTrigger>
            <MenubarContent>
              {examples.map((e) => (
                <MenubarItem key={e.key} onClick={() => void loadExampleGraph(e)}>
                  {e.label}
                </MenubarItem>
              ))}
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      </div>
      <div className="flex-1 flex items-center">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <button onClick={() => setViewPath([])} className="hover:underline text-xs">{graphName}</button>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {viewPath.map((id, i) => {
              const n = nodes.find((nn) => nn.id === id);
              const isLast = i === viewPath.length - 1;
              const label = (n?.data as any)?.label ?? (n?.data as any)?.type ?? id;
              return (
                <> 
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage className="text-xs">{label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <button className="hover:underline text-xs" onClick={() => setViewPath(viewPath.slice(0, i + 1))}>{label}</button>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="w-[1px]" />
    </div>
  );

  // SidebarMenus removed; moved to header menubar

  return (
    <GraphStateProvider value={graphStateValue}>
      <AppShell header={Header}> 
        <div className="w-full h-full relative">
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
          onDragOver={(event) => {
            if (event.dataTransfer?.types.includes(ASSET_DRAG_MIME)) {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }
          }}
          onDrop={handleAssetDrop}
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
        <PanelsOverlay className="top-12 h-[calc(100vh-48px)]" graph={graphData} />
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
          onDeleteNode={async (id) => {
            if (!id) return;
            await deleteNodeById(id);
            setMenu((m) => ({ ...m, open: false }));
          }}
          onClose={() => setMenu((m) => ({ ...m, open: false }))}
        />
      </div>
      </AppShell>
    </GraphStateProvider>
  );
}

export default App;
import { groupSelected as utilGroupSelected, ungroupGroup as utilUngroupGroup } from "./core/graph/grouping";
