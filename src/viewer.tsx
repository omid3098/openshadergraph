import React, { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ReactFlow, ReactFlowProvider, useEdgesState, useNodesState, useReactFlow, Background, BackgroundVariant, type Node as RFNode, type Edge as RFEdge } from "@xyflow/react";
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
import { attachNodesUpdateApi, type NodeUpdaterApi } from "./core/ui/nodeUpdaters";
import { parseDocGraphFromParams } from "./viewer/DocGraph";
import { inflateDocGraph } from "./viewer/inflateDocGraph";

type VNode = RFNode<any, string | undefined>;
type VEdge = RFEdge<any>;

function ViewerInner() {
  const rf = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<VNode>([] as VNode[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<VEdge>([] as VEdge[]);
  const [graph, setGraph] = useState<any>(null);
  const [curveMode] = useState<CurveMode>("default");
  const [theme] = useState<ThemeName>(() => (new URLSearchParams(location.search).get("theme") === "light" ? "light" : "dark"));

  const nodeUpdaterApi: NodeUpdaterApi = useMemo(() => ({
    updateInputValue: () => {},
    updatePropertyValue: () => {},
    updateNodeLabel: () => {},
    addNodeMeta: () => {},
    removeNodeMeta: () => {},
    updateNodeAsset: () => {},
  }), []);

  const settingsValue = useMemo(() => ({
    theme,
    setTheme: () => {},
    curveMode,
    setCurveMode: () => {},
    quickHotkeys: [],
    setQuickHotkeys: () => {},
  }), [theme, curveMode]);

  const nodesById = useMemo(() => new Map<string, any>(), [nodes]);
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
    const fit = params.get("fit") !== "false";
    const abort = new AbortController();
    const cache = createTemplateCache((path) => fetchNodeTemplate(path, abort.signal));
    const run = async () => {
      // Apply theme to document root for correct styles
      const themeParam = params.get("theme");
      if (themeParam === "light") document.documentElement.classList.remove("dark");
      else document.documentElement.classList.add("dark");

      // Load palette to resolve template paths
      let byType = new Map<string, { path: string }>();
      try {
        const palette = await fetchNodePalette(abort.signal);
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
          } catch (err) {
            if (abort.signal.aborted) return undefined;
            return undefined;
          }
        } catch (_err) {
          return undefined;
        }
      };

      const doc = parseDocGraphFromParams(params);
      if (!doc) return;
      const surface = await inflateDocGraph(doc, getTemplate);
      setGraph(surface);
      const assets = await loadAssetRegistry();
      const defaults = new Map<number, any>();
      const build = buildReactFlowGraph({ root: surface, defaults, assets, options: { nodeDefaults: { selectable: false } } });
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

  return (
    <SettingsProvider value={settingsValue}>
      <GraphStateProvider value={graphStateValue}>
        <ReactFlow<VNode, VEdge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          deleteKeyCode={[]}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={true}
          panOnScroll={true}
          zoomOnScroll={true}
          zoomOnPinch={true}
          selectionOnDrag={false}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
        />
        <Background id="bg" variant={BackgroundVariant.Dots} gap={24} size={2} color="rgba(255,255,255,0.08)" />
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


