import React, { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ReactFlow, ReactFlowProvider, useEdgesState, useNodesState, useReactFlow, Background, BackgroundVariant, type Node as RFNode, type Edge as RFEdge, type Connection } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./viewer.css";
import GraphNode from "./components/GraphNode";
import ColoredEdge from "./components/ColoredEdge";
import { buildReactFlowGraph } from "./core/ui/reactFlowGraph";
import { createTemplateCache } from "./core/ui/templateCache";
import { fetchNodeTemplate, fetchNodePalette } from "./core/schema/nodes";
import { prepareVisibleNodes } from "./core/ui/visible";
import { loadAssetRegistry } from "./core/assets/registry";
import { GraphStateProvider } from "./core/ui/GraphStateContext";
import { SettingsProvider, type CurveMode, type ThemeName } from "./ui/state/SettingsContext";
import { attachNodeUpdateApi, attachNodesUpdateApi, type NodeUpdaterApi } from "./core/ui/nodeUpdaters";
import { parseDocGraphFromSource } from "./viewer/DocGraph";
import { inflateDocGraph } from "./viewer/inflateDocGraph";
import { GraphContextMenu } from "./components/GraphContextMenu";
import { buildRFNodeFromTemplate } from "./core/ui/nodeFactory";
import type { NodePalette, NodePaletteItem, NodeTemplate } from "./core/schema/types";
import { connectSingleInputEdge } from "./core/ui/edges";
import AppShell from "./ui/layout/AppShell";

type VNode = RFNode<any, string | undefined>;
type VEdge = RFEdge<any>;

function ViewerInner() {
  const rf = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<VNode>([] as VNode[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<VEdge>([] as VEdge[]);
  const [graph, setGraph] = useState<any>(null);
  const [curveMode] = useState<CurveMode>("default");
  const [theme] = useState<ThemeName>(() => (new URLSearchParams(location.search).get("theme") === "light" ? "light" : "dark"));
  const idCounterRef = useRef<number>(0);
  const [palette, setPalette] = useState<NodePalette | null>(null);
  const [menu, setMenu] = useState<{ open: boolean; kind: "background" | "node" | "edge" | "selection"; x: number; y: number; targetId?: string }>({ open: false, kind: "background", x: 0, y: 0 });

  // Feature flags (from URL params or iframe data-*)
  const flags = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const frameEl: HTMLIFrameElement | null = (window as any).frameElement ?? null;
    const dataset = (frameEl && (frameEl as any).dataset) ? ((frameEl as any).dataset as Record<string, string | undefined>) : {};
    const read = (key: string, def = "false") => {
      const val = params.get(key) ?? dataset[key];
      return (val ?? def).toLowerCase() !== "false";
    };
    const pick = (key: string) => (params.get(key) ?? dataset[key] ?? "");
    return {
      interactive: read("interactive", "true"),
      compile: false,
      showSidebar: read("sidebar", "false"),
      showMenu: read("menubar", "false"),
      includePreview: false,
      includeGraphData: false,
      includeCompile: false,
      fit: read("fit", "true"),
      theme: pick("theme"),
    };
  }, []);

  // Lightweight node update API for the viewer (preserve parentId and positions)
  const nodeUpdaterApi: NodeUpdaterApi = useMemo(() => ({
    updateInputValue: (id, pinId, next) => {
      setNodes((prev) => prev.map((n) => {
        if (n.id !== id) return n;
        const tpl: any = (n.data as any)?.template;
        if (!tpl || !Array.isArray(tpl.inputs)) return n;
        const inputs = tpl.inputs.map((pin: any, idx: number) => {
          const pid = typeof pin.id === "number" ? pin.id : idx;
          if (pid !== pinId) return pin;
          return { ...pin, value: next };
        });
        const nextTpl = { ...tpl, inputs };
        return { ...n, data: { ...(n.data as any), template: nextTpl } } as any;
      }));
    },
    updatePropertyValue: (id, propId, next) => {
      setNodes((prev) => prev.map((n) => {
        if (n.id !== id) return n;
        const tpl: any = (n.data as any)?.template;
        if (!tpl || !Array.isArray(tpl.properties)) return n;
        const properties = tpl.properties.map((p: any) => (p && typeof p === "object" && p.id === propId ? { ...p, value: next } : p));
        const nextTpl = { ...tpl, properties };
        return { ...n, data: { ...(n.data as any), template: nextTpl } } as any;
      }));
    },
    updateNodeLabel: (id, label) => {
      setNodes((prev) => prev.map((n) => {
        if (n.id !== id) return n;
        return { ...n, data: { ...(n.data as any), label } } as any;
      }));
    },
    addNodeMeta: (id, metaKey) => {
      if (!metaKey) return;
      setNodes((prev) => prev.map((n) => {
        if (n.id !== id) return n;
        const tpl: any = (n.data as any)?.template ?? {};
        const meta: any[] = Array.isArray(tpl.meta) ? [...tpl.meta] : [];
        if (!meta.includes(metaKey)) meta.push(metaKey);
        const nextTpl = { ...tpl, meta };
        return { ...n, data: { ...(n.data as any), template: nextTpl } } as any;
      }));
    },
    removeNodeMeta: (id, metaKey) => {
      if (!metaKey) return;
      setNodes((prev) => prev.map((n) => {
        if (n.id !== id) return n;
        const tpl: any = (n.data as any)?.template ?? {};
        const meta: any[] = Array.isArray(tpl.meta) ? tpl.meta.filter((m: any) => m !== metaKey) : [];
        const nextTpl = { ...tpl, meta };
        return { ...n, data: { ...(n.data as any), template: nextTpl } } as any;
      }));
    },
    updateNodeAsset: (id, asset) => {
      setNodes((prev) => prev.map((n) => {
        if (n.id !== id) return n;
        const nextData: any = { ...(n.data as any) };
        if (asset && (asset as any).id && (asset as any).source) nextData.asset = { ...asset } as any;
        else delete nextData.asset;
        return { ...n, data: nextData } as any;
      }));
    },
  }), [setNodes]);

  const settingsValue = useMemo(() => ({
    theme,
    setTheme: () => {},
    curveMode,
    setCurveMode: () => {},
    quickHotkeys: [],
    setQuickHotkeys: () => {},
  }), [theme, curveMode]);

  const nodesById = useMemo(() => {
    const map = new Map<string, VNode>();
    for (const n of nodes) map.set(n.id, n);
    return map;
  }, [nodes]);
  const graphStateValue = useMemo(() => ({
    nodesById,
    nodeUpdaterApi,
    graph: graph,
    undo: () => {},
    redo: () => {},
    canUndo: false,
    canRedo: false,
    peekUndo: null,
    peekRedo: null,
  }), [graph, nodeUpdaterApi, nodesById]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const frameEl: HTMLIFrameElement | null = (window as any).frameElement ?? null;
    const dataset = (frameEl && (frameEl as any).dataset) ? ((frameEl as any).dataset as Record<string, string | undefined>) : {};
    const getFromData = (key: string): string | null => {
      // Map param keys to data-* (kebab-case) attributes
      const map: Record<string, string> = { graph64: "graph64", graph: "graph", demo: "demo", theme: "theme", fit: "fit", interactive: "interactive", compile: "compile", sidebar: "sidebar", menubar: "menubar", preview: "preview", graphdata: "graphdata" };
      const attr = map[key] ?? key;
      const val = dataset[attr];
      return typeof val === "string" ? val : null;
    };
    const get = (key: string): string | null => params.get(key) ?? getFromData(key);
    const fit = (get("fit") ?? "true") !== "false";
    const abort = new AbortController();
    const cache = createTemplateCache((path) => fetchNodeTemplate(path, abort.signal));
    const run = async () => {
      // Apply theme to document root for correct styles
      const themeParam = get("theme");
      if (themeParam === "light") document.documentElement.classList.remove("dark");
      else document.documentElement.classList.add("dark");

      // Load palette to resolve template paths
      let byType = new Map<string, { path: string }>();
      try {
        const palette = await fetchNodePalette(abort.signal);
        setPalette(palette);
        for (const item of palette.flat ?? []) byType.set(item.type, { path: (item as any).path });
      } catch (err: any) {
        if (abort.signal.aborted) return;
        console.warn("viewer: failed to fetch palette", err);
      }

      const getTemplate = async (type: string) => {
        const item = byType.get(type);
        if (!item) return undefined;
        try {
          try {
            return await cache.load(type, item.path);
          } catch (_err) {
            if (abort.signal.aborted) return undefined;
            return undefined;
          }
        } catch (_err) {
          return undefined;
        }
      };

      const doc = parseDocGraphFromSource({ get });
      if (!doc) return;
      const surface = await inflateDocGraph(doc, getTemplate);
      setGraph(surface);
      const assets = await loadAssetRegistry();
      const defaults = new Map<number, any>();
      const build = buildReactFlowGraph({ root: surface, defaults, assets, options: { nodeDefaults: { selectable: true } } });
      idCounterRef.current = build.maxId;
      const currentParentId = build.defaultViewPath.length ? build.defaultViewPath[build.defaultViewPath.length - 1] : undefined;
      const filteredNodes = (prepareVisibleNodes(build.nodes as any, currentParentId) as VNode[]).map((n) => ({ ...n, parentId: undefined }));
      const withApi = attachNodesUpdateApi(filteredNodes as any, nodeUpdaterApi) as VNode[];
      const visibleIdSet = new Set(withApi.map((n) => n.id));
      const filteredEdges = (build.edges as VEdge[]).filter((e) => visibleIdSet.has(e.source) && visibleIdSet.has(e.target));
      setNodes(withApi);
      setEdges(filteredEdges);
      if (fit) {
        // Wait for next tick so nodes mount
        requestAnimationFrame(() => rf.fitView({ padding: 0.2 }));
      }
    };
    run().catch((err) => {
      if (abort.signal.aborted) return;
      console.warn("viewer: init failed", err);
    });
    return () => abort.abort();
  }, [rf, setEdges, setNodes, nodeUpdaterApi]);

  const nodeTypes = useMemo(() => ({ graphNode: GraphNode }), [] as any);
  const edgeTypes = useMemo(() => ({ colored: ColoredEdge as any }), [] as any);

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => connectSingleInputEdge(eds, params));
  }, [setEdges]);

  const addNodeAt = useCallback(async (opts: { item: NodePaletteItem; x: number; y: number }) => {
    const { item, x, y } = opts;
    const nextId = String(idCounterRef.current + 1);
    let template: NodeTemplate | undefined;
    try {
      template = await fetchNodeTemplate(item.path);
    } catch (err) {
      console.warn("viewer: failed to fetch template", item.path, err);
    }
    const pos = rf.screenToFlowPosition({ x, y });
    const rfNode = buildRFNodeFromTemplate({ id: nextId, item, template, position: pos });
    const decorated = attachNodeUpdateApi(rfNode as any, nodeUpdaterApi) as any;
    idCounterRef.current = Number(nextId);
    setNodes((prev) => [...prev, decorated]);
  }, [nodeUpdaterApi, rf, setNodes]);

  const interactive = flags.interactive;
  const canvas = (
    <div className="w-full h-full" onContextMenu={(e) => {
      if (!interactive) return;
      e.preventDefault();
      setMenu({ open: true, kind: "background", x: e.clientX, y: e.clientY });
    }}>
      <ReactFlow<VNode, VEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={[]}
        nodesDraggable={interactive}
        nodesConnectable={interactive}
        elementsSelectable={interactive}
        panOnDrag={true}
        panOnScroll={true}
        zoomOnScroll={true}
        zoomOnPinch={true}
        selectionOnDrag={interactive}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      />
      <Background id="bg" variant={BackgroundVariant.Dots} gap={24} size={2} color="rgba(255,255,255,0.08)" />
      {interactive && (
        <GraphContextMenu
          open={menu.open}
          kind={menu.kind}
          x={menu.x}
          y={menu.y}
          palette={palette ?? undefined}
          onAddNode={(item) => {
            if (!item) return;
            void addNodeAt({ item, x: menu.x, y: menu.y });
            setMenu((m) => ({ ...m, open: false }));
          }}
          onClose={() => setMenu((m) => ({ ...m, open: false }))}
          selectedCount={nodes.filter((n) => n.selected).length}
        />
      )}
    </div>
  );

  return (
    <SettingsProvider value={settingsValue}>
      <GraphStateProvider value={graphStateValue}>
        {(flags.showSidebar || flags.showMenu) ? (
          <AppShell header={<div className="text-sm">OpenShaderGraph Viewer</div>} sidebarContent={undefined} theme={theme as any}>
            {canvas}
          </AppShell>
        ) : (
          canvas
        )}
      </GraphStateProvider>
    </SettingsProvider>
  );
}

function ViewerApp() {
  return (
    <ReactFlowProvider>
      <ViewerInner />
    </ReactFlowProvider>
  );
}

const elem = document.getElementById("root")!;
const root = createRoot(elem);
root.render(
  <StrictMode>
    <div style={{ width: "100vw", height: "100vh" }}>
      <ViewerApp />
    </div>
  </StrictMode>
);


