import "./index.css";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Position,
  SelectionMode,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GraphContextMenu, type ContextKind } from "./components/GraphContextMenu";
import { fetchNodePalette, fetchNodeTemplate } from "./core/schema/nodes";
import type { NodePalette, NodePaletteItem, NodeTemplate } from "./core/schema/types";
// Panels are now hosted inside a unified dock overlay
import { useReactFlow } from "@xyflow/react";
import { GraphNode } from "./components/GraphNode";
import { buildRFNodeFromTemplate, parseEditorSize } from "./core/ui/nodeFactory";
import { attachNodeUpdateApi, attachNodesUpdateApi, type NodeUpdaterApi } from "./core/ui/nodeUpdaters";
import { GraphStateProvider } from "./core/ui/GraphStateContext";
import { isAbortError } from "./lib/errors";
import { prepareVisibleNodes } from "./core/ui/visible";
import { buildGraphData } from "./core/ui/graphData";
import { connectSingleInputEdge } from "./core/ui/edges";
import {
  clearRecentGraphs,
  loadRecentGraphs,
  removeRecentGraph,
  saveRecentGraph,
  type RecentGraphEntry,
} from "./core/ui/recentGraphs";
import { restoreInputsToDefaults } from "./core/ui/resetInputs";
import { ASSET_DRAG_MIME, parseAssetDragPayload } from "./core/assets/kind";
import { AppShell } from "./ui/layout/AppShell";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "./components/ui/breadcrumb";
import { Menubar, MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem, MenubarSeparator, MenubarSub, MenubarSubTrigger, MenubarSubContent } from "./components/ui/menubar";
import type { Graph } from "@/core/graph/types";
import { collectEditorNodes, computeEditorSpawnPosition, EDITOR_PANEL_TYPES, type EditorPanelKey } from "./core/ui/editorNodes";
import { Check } from "lucide-react";

const nodeDefaults = {
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
};

const initialNodes: Node[] = [];

const initialEdges: Edge[] = [];

type ViewMenuItem = { key: EditorPanelKey; label: string; digit: "1" | "2" | "3" | "4" | "5"; hotkey: string };

const VIEW_MENU_ITEMS: ViewMenuItem[] = [
  { key: "properties", label: "Properties", digit: "1", hotkey: "⌘1" },
  { key: "compile", label: "Compile", digit: "2", hotkey: "⌘2" },
  { key: "graphdata", label: "Graph Data", digit: "3", hotkey: "⌘3" },
  { key: "assets", label: "Assets", digit: "4", hotkey: "⌘4" },
  { key: "preview", label: "Preview", digit: "5", hotkey: "⌘5" },
];

const VIEW_HOTKEY_MAP: Record<string, EditorPanelKey> = VIEW_MENU_ITEMS.reduce<Record<string, EditorPanelKey>>(
  (acc, item) => {
    acc[item.digit] = item.key;
    return acc;
  },
  {}
);

export function App() {
  const rf = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [palette, setPalette] = useState<NodePalette | null>(null);
  const idCounter = useRef(0);
  const [viewPath, setViewPath] = useState<string[]>([]); // breadcrumb of nested groups
  const [graphName, setGraphName] = useState<string>("UntitledGraph");
  const [examples, setExamples] = useState<Array<{ key: string; label: string }>>([]);
  const fileHandleRef = useRef<any | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [recentGraphs, setRecentGraphs] = useState<RecentGraphEntry[]>([]);
  const [menu, setMenu] = useState<{
    open: boolean;
    kind: ContextKind;
    x: number;
    y: number;
    targetId?: string;
  }>({ open: false, kind: "background", x: 0, y: 0 });
  const flowContainerRef = useRef<HTMLDivElement | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);

  const onConnect = (params: Connection) =>
    setEdges((eds) => connectSingleInputEdge(eds, params));

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

  const nodesRef = useRef<Node[]>(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  const edgesRef = useRef<Edge[]>(edges);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  const graphNameRef = useRef(graphName);
  useEffect(() => { graphNameRef.current = graphName; }, [graphName]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const updatePointer = (event: PointerEvent) => {
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener("pointermove", updatePointer, { passive: true });
    return () => window.removeEventListener("pointermove", updatePointer);
  }, []);

  useEffect(() => {
    setRecentGraphs(loadRecentGraphs());
  }, []);

  const getFlowCenterClient = useCallback((): { x: number; y: number } => {
    const rect = flowContainerRef.current?.getBoundingClientRect();
    if (rect) {
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    if (typeof window !== "undefined") {
      return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }
    return { x: 0, y: 0 };
  }, []);

  const [graphData, setGraphData] = useState<Graph>(() => buildGraphData(nodes as any, edges as any, graphName) as any);

  const resizingEditorIdsRef = useRef(new Set<string>());
  const pendingGraphUpdateRef = useRef(false);

  const recomputeGraphData = useCallback(() => {
    const next = buildGraphData(nodesRef.current as any, edgesRef.current as any, graphNameRef.current);
    setGraphData(next as any);
  }, []);

  useEffect(() => {
    if (resizingEditorIdsRef.current.size > 0) {
      pendingGraphUpdateRef.current = true;
      return;
    }
    pendingGraphUpdateRef.current = false;
    recomputeGraphData();
  }, [nodes, edges, graphName, recomputeGraphData]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type === "remove") {
          resizingEditorIdsRef.current.delete(change.id);
          continue;
        }
        if (change.type !== "dimensions" || change.resizing === undefined) continue;
        const node = nodesRef.current.find((n) => n.id === change.id);
        const meta = (() => {
          if (!node) return [] as string[];
          const template = (node.data as any)?.template;
          return Array.isArray(template?.meta) ? (template.meta as string[]) : [];
        })();
        if (!meta.includes("editor_node")) continue;
        if (change.resizing) {
          resizingEditorIdsRef.current.add(change.id);
          pendingGraphUpdateRef.current = true;
        } else {
          resizingEditorIdsRef.current.delete(change.id);
          if (resizingEditorIdsRef.current.size === 0 && pendingGraphUpdateRef.current) {
            pendingGraphUpdateRef.current = false;
            const flush = () => recomputeGraphData();
            if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
              window.requestAnimationFrame(flush);
            } else {
              setTimeout(flush, 0);
            }
          }
        }
      }
      onNodesChange(changes);
    },
    [onNodesChange, recomputeGraphData]
  );

  // Visible graph based on current viewPath (root vs. inside a group)
  const currentParentId = viewPath.length ? viewPath[viewPath.length - 1] : undefined;
  const visibleNodes = useMemo(() => {
    return prepareVisibleNodes(nodes as any, currentParentId) as any;
  }, [nodes, currentParentId]);
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n: any) => n.id)), [visibleNodes]);
  const visibleEdges = useMemo(() => {
    return edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));
  }, [edges, visibleNodeIds]);

  const activeEditorPanels = useMemo(() => {
    const set = new Set<EditorPanelKey>();
    const parent = currentParentId ?? undefined;
    for (const item of VIEW_MENU_ITEMS) {
      const type = EDITOR_PANEL_TYPES[item.key];
      if (!type) continue;
      if (collectEditorNodes(nodes, type, parent).length) {
        set.add(item.key);
      }
    }
    return set;
  }, [nodes, currentParentId]);

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
    () => ({ nodesById, nodeUpdaterApi, graph: graphData as any }),
    [nodesById, nodeUpdaterApi, graphData]
  );

  const toggleEditorNode = useCallback(
    async (
      panel: EditorPanelKey,
      origin?: { kind: "hotkey"; client: { x: number; y: number } } | { kind: "menu" }
    ) => {
      const type = EDITOR_PANEL_TYPES[panel];
      if (!type) return;
      const parent = currentParentId ?? undefined;
      const existing = collectEditorNodes(nodesRef.current, type, parent);
      if (existing.length) {
        const removeIds = new Set(existing.map((node) => node.id));
        for (const id of removeIds) {
          resizingEditorIdsRef.current.delete(id);
        }
        setNodes((prev) => prev.filter((node) => !removeIds.has(node.id)));
        setEdges((prev) => prev.filter((edge) => !removeIds.has(edge.source) && !removeIds.has(edge.target)));
        return;
      }

      const item = paletteByType.get(type);
      if (!item) {
        console.warn("Editor panel template missing for", type);
        return;
      }

      let template: NodeTemplate | undefined;
      try {
        template = await fetchNodeTemplate(item.path);
      } catch (err) {
        console.warn("Failed to load editor panel template", type, err);
      }

      const nextId = String(++idCounter.current);
      const parentNode = currentParentId ? rf.getNode(currentParentId) : undefined;
      const parentPosition = (() => {
        const abs = parentNode?.positionAbsolute;
        if (abs && Number.isFinite(abs.x) && Number.isFinite(abs.y)) return abs;
        const rel = parentNode?.position;
        if (rel && Number.isFinite(rel.x) && Number.isFinite(rel.y)) return rel;
        return { x: 0, y: 0 };
      })();

      let spawnPosition: { x: number; y: number } | null = null;
      let clientPoint: { x: number; y: number } | null = null;

      if (origin?.kind === "hotkey") {
        clientPoint = origin.client;
      } else if (origin?.kind === "menu") {
        clientPoint = getFlowCenterClient();
      }

      if (!clientPoint) {
        clientPoint = getFlowCenterClient();
      }

      if (clientPoint) {
        const projected = rf.screenToFlowPosition(clientPoint);
        spawnPosition = parent
          ? {
              x: projected.x - parentPosition.x,
              y: projected.y - parentPosition.y,
            }
          : projected;
      }

      if (!spawnPosition) {
        spawnPosition = computeEditorSpawnPosition(nodesRef.current, parent);
      }

      const rfArgs: any = {
        id: nextId,
        item,
        position: spawnPosition,
        nodeDefaults,
      };
      if (template) rfArgs.template = template;
      if (parent) rfArgs.parentId = parent;
      const rfNode = buildRFNodeFromTemplate(rfArgs);
      const decoratedNode = attachNodeUpdateApi(rfNode as any, nodeUpdaterApi);
      setNodes((prev) => [...prev, decoratedNode as any]);
    },
    [currentParentId, paletteByType, setNodes, setEdges, nodeUpdaterApi, rf, getFlowCenterClient]
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!event.metaKey || event.altKey || event.shiftKey || event.ctrlKey) return;
      if (event.repeat) return;

      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (target.isContentEditable) return;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      }

      let digit = event.key;
      if (!VIEW_HOTKEY_MAP[digit] && typeof event.code === "string" && event.code.startsWith("Digit")) {
        digit = event.code.slice(-1);
      }

      const panel = VIEW_HOTKEY_MAP[digit];
      if (!panel) return;

      event.preventDefault();
      const pointer = lastPointerRef.current ?? getFlowCenterClient();
      void toggleEditorNode(panel, { kind: "hotkey", client: pointer });
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleEditorNode, getFlowCenterClient]);

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
  // Helper: Inflate canonical graph JSON into RF nodes/edges and load
  const inflateAndLoadGraph = useCallback(async (graph: GNode, label: string) => {
    // Support wrapper root with empty type -> pick first surface node
    const root: any = graph as any;
    const rootGraph: GNode = (!root?.type || root.type === "") && Array.isArray(root?.nodes)
      ? (root.nodes.find((n: any) => n?.type === "surface") ?? root.nodes[0])
      : graph;

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

      const dimensions = parseEditorSize(filteredMeta as string[]);
      const nodePayload: any = {
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
      };
      if (Number.isFinite(dimensions.width) || Number.isFinite(dimensions.height)) {
        nodePayload.style = {
          ...(Number.isFinite(dimensions.width) ? { width: dimensions.width } : {}),
          ...(Number.isFinite(dimensions.height) ? { height: dimensions.height } : {}),
        };
      }
      createdNodes.push(nodePayload);
      for (const child of n.nodes ?? []) walk(child, idStr, depth + 1);
    };
    walk(rootGraph, undefined, 0);

    // Build edges from input pin refs ../<nodeId>/<pinId>
    const refRe = /^\.\.\/(\d+)\/(\d+)$/;
    for (const gid of Object.keys(all)) {
      const gn = all[gid];
      if (!gn || !Array.isArray(gn.inputs)) continue;
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
    const surfaceId = String(rootGraph.id);
    const fragmentPass = (rootGraph.nodes ?? []).find((n) => n.type === "fragment_pass");
    const vertexPass = (rootGraph.nodes ?? []).find((n) => n.type === "vertex_pass");
    const defaultPath = fragmentPass
      ? [surfaceId, String(fragmentPass.id)]
      : vertexPass
        ? [surfaceId, String(vertexPass.id)]
        : [surfaceId];

    resizingEditorIdsRef.current.clear();
    pendingGraphUpdateRef.current = false;
    setNodes(attachNodesUpdateApi(createdNodes as any, nodeUpdaterApi) as any);
    setEdges(createdEdges);
    setGraphName(label ?? "UntitledGraph");
    setViewPath(defaultPath);
  }, [setNodes, setEdges, setGraphName, setViewPath, nodeUpdaterApi]);

  const loadExampleGraph = useCallback(async (ex: { key: string; label: string }) => {
    try {
      const url = new URL("/api/example-graphs", location.origin);
      url.searchParams.set("name", ex.key);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const graph = data.graph as GNode;
      await inflateAndLoadGraph(graph, ex.label ?? "UntitledGraph");
    } catch (err) {
      console.warn("Failed to load example graph", ex, err);
    }
  }, [inflateAndLoadGraph]);

  // File save/open helpers (.osg JSON)
  const serializeGraph = useCallback(() => {
    const data = buildGraphData(nodes as any, edges as any, graphName);
    return JSON.stringify(data, null, 2);
  }, [nodes, edges, graphName]);

  const triggerDownload = (name: string, contents: string) => {
    const blob = new Blob([contents], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const rememberRecentGraph = useCallback(
    (name: string, contents: string) => {
      setRecentGraphs(saveRecentGraph({ name, contents }));
    },
    [setRecentGraphs]
  );

  const openGraphFromContents = useCallback(
    async (opts: { name: string; contents: string; handle?: any; remember?: boolean }) => {
      const { name, contents, handle, remember = true } = opts;
      const safeName = name && name.trim().length ? name.trim() : "UntitledGraph.osg";
      const parsed = JSON.parse(contents);
      const baseName = safeName.replace(/\.[^.]+$/, "");
      const label = String(parsed?.name ?? (baseName || "UntitledGraph"));
      await inflateAndLoadGraph(parsed, label);
      setFileName(safeName);
      fileHandleRef.current = handle ?? null;
      if (remember) rememberRecentGraph(safeName, contents);
    },
    [inflateAndLoadGraph, rememberRecentGraph]
  );

  const writeFileHandle = async (handle: any, contents: string) => {
    try {
      const writable = await handle.createWritable();
      await writable.write(contents);
      await writable.close();
    } catch (err) {
      console.warn("Failed to write file", err);
      throw err;
    }
  };

  const handleSaveAs = useCallback(async () => {
    try {
      const contents = serializeGraph();
      const suggested = (graphName || "UntitledGraph").replace(/\s+/g, "_") + ".osg";
      const supportsPicker = typeof (window as any).showSaveFilePicker === "function";
      if (supportsPicker) {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: suggested,
          types: [{ description: "OpenShaderGraph (*.osg)", accept: { "application/json": [".osg"] } }],
        });
        await writeFileHandle(handle, contents);
        fileHandleRef.current = handle;
        setFileName(handle.name || suggested);
        rememberRecentGraph(handle.name || suggested, contents);
      } else {
        triggerDownload(suggested, contents);
        fileHandleRef.current = null;
        setFileName(suggested);
        rememberRecentGraph(suggested, contents);
      }
    } catch (_err) {
      // user cancel or error: ignore
    }
  }, [graphName, serializeGraph, rememberRecentGraph]);

  const handleSave = useCallback(async () => {
    const contents = serializeGraph();
    const handle = fileHandleRef.current;
    if (handle) {
      try {
        await writeFileHandle(handle, contents);
        const name = (fileName && fileName.trim().length ? fileName : handle.name) || "UntitledGraph.osg";
        rememberRecentGraph(name, contents);
        return;
      } catch (_err) {
        // Fallback to Save As on failure
      }
    }
    await handleSaveAs();
  }, [fileName, serializeGraph, handleSaveAs, rememberRecentGraph]);

  const handleOpen = useCallback(async () => {
    const supportsPicker = typeof (window as any).showOpenFilePicker === "function";
    try {
      let file: File | null = null;
      let pickerHandle: any | undefined;
      if (supportsPicker) {
        const [handle] = await (window as any).showOpenFilePicker({
          multiple: false,
          types: [{ description: "OpenShaderGraph (*.osg)", accept: { "application/json": [".osg"] } }],
        });
        pickerHandle = handle;
        file = await handle.getFile();
      } else {
        // Fallback: input[type=file]
        file = await new Promise<File | null>((resolve) => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = ".osg,application/json";
          input.onchange = () => {
            const f = input.files && input.files[0] ? input.files[0] : null;
            resolve(f);
            input.remove();
          };
          document.body.appendChild(input);
          input.click();
        });
      }
      if (!file) return;
      const text = await file.text();
      const fallbackName = (file.name && file.name.trim().length ? file.name : fileName) || "UntitledGraph.osg";
      await openGraphFromContents({ name: fallbackName, contents: text, handle: pickerHandle });
    } catch (_err) {
      // user cancel or error: ignore
    }
  }, [fileName, openGraphFromContents]);

  const handleOpenRecent = useCallback(
    async (entry: RecentGraphEntry) => {
      try {
        await openGraphFromContents({ name: entry.name, contents: entry.contents });
      } catch (err) {
        console.warn("Failed to open recent graph", entry.name, err);
        setRecentGraphs(removeRecentGraph(entry.name));
      }
    },
    [openGraphFromContents, setRecentGraphs]
  );

  const handleClearRecent = useCallback(() => {
    setRecentGraphs(clearRecentGraphs());
  }, [setRecentGraphs]);

  // Create a brand-new surface graph with vertex + fragment passes
  const createNewGraph = useCallback(
    async (shading: "pbr" | "unlit" | "toon") => {
      try {
        // Ensure palette is ready for template resolves
        if (!paletteByType.size) return;

        // Load defaults for required node types
        const surfaceTpl = await loadTemplateDefaults("surface");
        const vpassTpl = await loadTemplateDefaults("vertex_pass");
        const fpassTpl = await loadTemplateDefaults("fragment_pass");
        const voutTpl = await loadTemplateDefaults("vertex_output");
        const foutTpl = await loadTemplateDefaults("fragment_output");
        if (!surfaceTpl || !vpassTpl || !fpassTpl || !voutTpl || !foutTpl) {
          console.warn("Missing required templates for new graph");
          return;
        }

        // Deep clone to avoid mutating cached templates
        const clone = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj));
        const surface = clone(surfaceTpl);
        const vertexPass = clone(vpassTpl);
        const fragmentPass = clone(fpassTpl);
        const vertexOutput = clone(voutTpl);
        const fragmentOutput = clone(foutTpl);

        // Ensure passes contain their IO nodes from defaults
        vertexPass.nodes = [vertexOutput];
        fragmentPass.nodes = [fragmentOutput];

        // Set fragment shading property
        const props: any[] = Array.isArray(fragmentOutput.properties)
          ? clone(fragmentOutput.properties as any[])
          : [];
        let set = false;
        for (let i = 0; i < props.length; i++) {
          const p = props[i];
          if (p && typeof p === "object" && p.id === "shading_model") {
            props[i] = { ...p, value: shading };
            set = true;
            break;
          }
        }
        if (!set) props.push({ id: "shading_model", type: "enum", value: shading });
        fragmentOutput.properties = props as any;

        // Compose surface children
        surface.nodes = [vertexPass, fragmentPass];

        // Assign unique incremental ids across the tree
        let next = 1;
        const assignIds = (n: any): void => {
          n.id = next++;
          if (Array.isArray(n.nodes)) {
            for (const c of n.nodes) assignIds(c);
          }
        };
        assignIds(surface);

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

        // Flatten graph nodes and build ReactFlow nodes (no edges initially)
        const createdNodes: Node[] = [];
        const all: Record<string, GNode> = {};
        const depthX = 240;
        const rowY = 120;
        const baseX = 80;
        const baseY = 40;
        const perParentRow: Record<string, number> = {};

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

          const dimensions = parseEditorSize(meta as string[]);
          const nodePayload: any = {
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
                meta,
                position: n.position ?? [pos.x, pos.y],
                nodes: n.nodes ?? [],
                inputs: n.inputs ?? [],
                outputs: n.outputs ?? [],
                properties,
              },
            },
            ...(parentId ? { parentId } : {}),
            ...nodeDefaults,
          };
          if (Number.isFinite(dimensions.width) || Number.isFinite(dimensions.height)) {
            nodePayload.style = {
              ...(Number.isFinite(dimensions.width) ? { width: dimensions.width } : {}),
              ...(Number.isFinite(dimensions.height) ? { height: dimensions.height } : {}),
            };
          }
          createdNodes.push(nodePayload);
          for (const child of n.nodes ?? []) walk(child, idStr, depth + 1);
        };
        walk(surface as unknown as GNode);

        const createdEdges: Edge[] = [];

        // Compute idCounter from max id
        const maxId = Math.max(...Object.keys(all).map((s) => Number(s)));
        idCounter.current = maxId;

        // Default view path: surface -> fragment_pass
        const surfaceId = String(surface.id);
        const fragmentPassNode = (surface.nodes ?? []).find((n: any) => n?.type === "fragment_pass");
        const vertexPassNode = (surface.nodes ?? []).find((n: any) => n?.type === "vertex_pass");
        const defaultPath = fragmentPassNode
          ? [surfaceId, String(fragmentPassNode.id)]
          : vertexPassNode
            ? [surfaceId, String(vertexPassNode.id)]
            : [surfaceId];

        // Apply state
        resizingEditorIdsRef.current.clear();
        pendingGraphUpdateRef.current = false;
        setNodes(attachNodesUpdateApi(createdNodes as any, nodeUpdaterApi) as any);
        setEdges(createdEdges);
        setGraphName(`Untitled ${shading.charAt(0).toUpperCase()}${shading.slice(1)}`);
        setViewPath(defaultPath);
      } catch (err) {
        console.warn("Failed to create new graph", shading, err);
      }
    },
    [paletteByType, loadTemplateDefaults, setNodes, setEdges, setGraphName, setViewPath, nodeUpdaterApi]
  );

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
          await loadExampleGraph(list[0]!);
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
    const rfArgs: any = {
      id: nextId,
      item,
      position: pos,
      nodeDefaults,
    };
    if (template) rfArgs.template = template;
    if (currentParentId) rfArgs.parentId = currentParentId;
    const rfNode = buildRFNodeFromTemplate(rfArgs);
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
    const baseArgs: any = {
      id: nextId,
      item,
      position,
    };
    if (template) baseArgs.template = template;
    if (currentParentId) baseArgs.parentId = currentParentId;
    const baseNode = buildRFNodeFromTemplate(baseArgs);
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
              <MenubarSub>
                <MenubarSubTrigger>New</MenubarSubTrigger>
                <MenubarSubContent>
                  <MenubarItem onClick={() => void createNewGraph("pbr")}>PBR</MenubarItem>
                  <MenubarItem onClick={() => void createNewGraph("unlit")}>Unlit</MenubarItem>
                  <MenubarItem onClick={() => void createNewGraph("toon")}>Toon</MenubarItem>
                </MenubarSubContent>
              </MenubarSub>
              <MenubarItem onClick={() => void handleOpen()}>Open…</MenubarItem>
              {recentGraphs.length ? (
                <MenubarSub>
                  <MenubarSubTrigger>Open Recent</MenubarSubTrigger>
                  <MenubarSubContent>
                    {recentGraphs.map((entry) => (
                      <MenubarItem key={entry.name} onClick={() => void handleOpenRecent(entry)}>
                        {entry.name}
                      </MenubarItem>
                    ))}
                    <MenubarSeparator />
                    <MenubarItem onClick={handleClearRecent}>Clear Menu</MenubarItem>
                  </MenubarSubContent>
                </MenubarSub>
              ) : null}
              <MenubarSeparator />
              <MenubarItem onClick={() => void handleSave()}>Save</MenubarItem>
              <MenubarItem onClick={() => void handleSaveAs()}>Save As…</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>View</MenubarTrigger>
            <MenubarContent>
              {VIEW_MENU_ITEMS.map(({ key, label, hotkey }) => {
                const active = activeEditorPanels.has(key);
                return (
                  <MenubarItem
                    key={key}
                    data-state={active ? "checked" : "unchecked"}
                    onClick={() => void toggleEditorNode(key, { kind: "menu" })}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        {active ? (
                          <Check aria-hidden="true" className="h-3 w-3" />
                        ) : (
                          <span aria-hidden="true" className="inline-block h-3 w-3" />
                        )}
                        <span>{label}</span>
                      </span>
                      <span className="text-[10px] uppercase text-muted-foreground">{hotkey}</span>
                    </div>
                  </MenubarItem>
                );
              })}
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
              const key = `${id}-${i}`;
              return (
                <Fragment key={key}>
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
                </Fragment>
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
        <div ref={flowContainerRef} className="w-full h-full relative">
        <ReactFlow
          nodes={visibleNodes}
          edges={visibleEdges}
          nodeTypes={{ graphNode: GraphNode }}
          nodeDragHandle=".node-drag-handle"
          onNodesChange={handleNodesChange}
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
        <GraphContextMenu
          open={menu.open}
          kind={menu.kind}
          x={menu.x}
          y={menu.y}
          {...(menu.targetId ? { targetId: menu.targetId } : {})}
          {...(palette ? { palette } : {})}
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
