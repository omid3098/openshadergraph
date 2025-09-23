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
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { isConnectionCompatible, getSourceType, getTargetType, normalizePinType, getPinTypeFor, arePinTypesCompatible } from "@/core/ui/compat";
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { GraphContextMenu, type ContextKind } from "./components/GraphContextMenu";
import { fetchNodePalette, fetchNodeTemplate } from "./core/schema/nodes";
import type { NodePalette, NodePaletteItem, NodeTemplate } from "./core/schema/types";
import { GraphNode } from "./components/GraphNode";
import ColoredEdge from "./components/ColoredEdge";
import { buildRFNodeFromTemplate, parseEditorSize } from "./core/ui/nodeFactory";
import {
  attachNodeUpdateApi,
  attachNodesUpdateApi,
  type NodeAssetPayload,
  type NodeUpdaterApi,
} from "./core/ui/nodeUpdaters";
import { GraphStateProvider } from "./core/ui/GraphStateContext";
import { isAbortError } from "./lib/errors";
import { prepareVisibleNodes } from "./core/ui/visible";
import { buildGraphData } from "./core/ui/graphData";
import { serializeGraph as serializeGraphForSave, inflateGraph } from "./core/ui/graphSerde";
import { connectSingleInputEdge } from "./core/ui/edges";
import {
  clearRecentGraphs,
  loadRecentGraphs,
  removeRecentGraph,
  saveRecentGraph,
  type RecentGraphEntry,
} from "./core/ui/recentGraphs";
import { loadRecentGraphHandle, removeRecentGraphHandle, saveRecentGraphHandle } from "./core/ui/recentGraphHandles";
import { restoreInputsToDefaults } from "./core/ui/resetInputs";
import { ASSET_DRAG_MIME, parseAssetDragPayload } from "./core/assets/kind";
import { loadAssetRegistry } from "./core/assets/registry";
import { createTemplateCache, type TemplateCache } from "./core/ui/templateCache";
import { buildReactFlowGraph } from "./core/ui/reactFlowGraph";
import { AppShell } from "./ui/layout/AppShell";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "./components/ui/breadcrumb";
import { Menubar, MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem, MenubarSeparator, MenubarSub, MenubarSubTrigger, MenubarSubContent } from "./components/ui/menubar";
import type { Graph } from "@/core/graph/types";
import { collectEditorNodes, computeEditorSpawnPosition, EDITOR_PANEL_TYPES, type EditorPanelKey } from "./core/ui/editorNodes";
import { Check } from "lucide-react";
import { groupSelected as utilGroupSelected, ungroupGroup as utilUngroupGroup } from "./core/graph/grouping";

const nodeDefaults = {
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
};

const initialNodes: Node[] = [];

const initialEdges: Edge[] = [];

type ViewMenuItem = { key: EditorPanelKey; label: string; digit: "1" | "2" | "3" | "4" | "5"; hotkey: string };

type CanonicalNode = {
  id: number;
  type: string;
  name?: string;
  meta?: any[];
  position?: [number, number];
  nodes?: CanonicalNode[];
  inputs?: Array<{ id: number; name: string; type: any; value?: any }>;
  outputs?: Array<{ id: number; name: string; type: any }>;
  properties?: any[];
};

function triggerDownload(name: string, contents: string) {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

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
  const [recentGraphsInitialized, setRecentGraphsInitialized] = useState(false);
  const SESSION_GRAPH_KEY = "openshadergraph.sessionGraph";
  const [menu, setMenu] = useState<{
    open: boolean;
    kind: ContextKind;
    x: number;
    y: number;
    targetId?: string;
  }>({ open: false, kind: "background", x: 0, y: 0 });
  const [menuPaletteOverride, setMenuPaletteOverride] = useState<NodePalette | null>(null);
  const [showCompileOnly, setShowCompileOnly] = useState<boolean>(false);
  const flowContainerRef = useRef<HTMLDivElement | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const initialLoadDoneRef = useRef(false);
  const startupAttemptedRef = useRef(false);
  const fitAfterLoadRef = useRef(false);
  const connectDragRef = useRef<{ side: "source" | "target"; nodeId: string; handleId: string; type: ReturnType<typeof normalizePinType> } | null>(null);
  const pendingConnectRef = useRef<{ side: "source" | "target"; nodeId: string; handleId: string; type: ReturnType<typeof normalizePinType> } | null>(null);
  const pinIndexCacheRef = useRef<Map<string, { inputs: ReturnType<typeof normalizePinType>[]; outputs: ReturnType<typeof normalizePinType>[] }>>(new Map());

  // MiniMap theme colors sourced from CSS variables and updated when theme changes
  const [mmColors, setMmColors] = useState<{ node: string; stroke: string; mask: string }>(() => {
    if (typeof document === "undefined") return { node: "#ccc", stroke: "#888", mask: "rgba(0,0,0,0.12)" };
    const cs = getComputedStyle(document.documentElement);
    return {
      node: (cs.getPropertyValue("--minimap-node") || "#ccc").trim(),
      stroke: (cs.getPropertyValue("--minimap-stroke") || "#888").trim(),
      mask: (cs.getPropertyValue("--minimap-mask") || "rgba(0,0,0,0.12)").trim(),
    };
  });
  useEffect(() => {
    if (typeof document === "undefined") return;
    const read = () => {
      const cs = getComputedStyle(document.documentElement);
      setMmColors({
        node: (cs.getPropertyValue("--minimap-node") || "#ccc").trim(),
        stroke: (cs.getPropertyValue("--minimap-stroke") || "#888").trim(),
        mask: (cs.getPropertyValue("--minimap-mask") || "rgba(0,0,0,0.12)").trim(),
      });
    };
    read();
    const el = document.documentElement;
    const obs = new MutationObserver((m) => {
      for (const rec of m) {
        if (rec.type === "attributes" && rec.attributeName === "class") read();
      }
    });
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const onConnect = (params: Connection) => {
    const nodesNow = nodesRef.current;
    const ok = isConnectionCompatible(nodesNow as any, params);
    if (!ok) {
      // Attempt adapter insertion for known cases (sampler2D->float/vecN, float->vecN, vec4->vec3, vec3->vec4)
      const srcType = getSourceType(nodesRef.current as any, params as any);
      const dstType = getTargetType(nodesRef.current as any, params as any);
      const paletteGet = (t: string) => paletteByType.get(t);

      const insertAndConnect = async (item: NodePaletteItem, position: { x: number; y: number }, template?: NodeTemplate, hookups?: (id: string) => void) => {
        const nextId = String(++idCounter.current);
        const rfArgs: any = { id: nextId, item, position, nodeDefaults };
        if (template) rfArgs.template = template;
        const rfNode = buildRFNodeFromTemplate(rfArgs);
        const decoratedNode = attachNodeUpdateApi(rfNode as any, nodeUpdaterApi);
        setNodes((prev) => [...prev, decoratedNode as any]);
        if (hookups) hookups(nextId);
      };

      const srcNode = rf.getNode(String(params.source));
      const dstNode = rf.getNode(String(params.target));
      const mid = (() => {
        const sx = srcNode?.position?.x ?? 0; const sy = srcNode?.position?.y ?? 0;
        const tx = dstNode?.position?.x ?? 0; const ty = dstNode?.position?.y ?? 0;
        return { x: Math.round((sx + tx) / 2), y: Math.round((sy + ty) / 2) };
      })();

      // 1) TextureSampler
      if (srcType === "sampler2d" && (dstType === "float3" || dstType === "float4" || dstType === "float2" || dstType === "float")) {
        const item = paletteGet("texture_sampler");
        if (item) {
          (async () => {
            let template: NodeTemplate | undefined;
            try { template = await fetchNodeTemplate(item.path); } catch (_err) { /* ignore */ }
            await insertAndConnect(item, mid, template, (id) => {
              const toSampler: Connection = { source: String(params.source), sourceHandle: params.sourceHandle, target: id, targetHandle: "in-0" } as any;
              const outHandle = dstType === "float" ? "out-1" : "out-0";
              const fromSampler: Connection = { source: id, sourceHandle: outHandle, target: String(params.target), targetHandle: params.targetHandle } as any;
              setEdges((eds) => ensureColoredEdges(connectSingleInputEdge(connectSingleInputEdge(eds, toSampler), fromSampler), nodesRef.current));
            });
          })();
          return;
        }
      }

      // 2) Broadcast float -> vecN via combineN
      if (srcType === "float" && (dstType === "float2" || dstType === "float3" || dstType === "float4")) {
        const map: Record<string, string> = { float2: "combine2", float3: "combine3", float4: "combine4" };
        const key = map[dstType as keyof typeof map];
        const item = key ? paletteGet(key) : undefined;
        if (item) {
          (async () => {
            let template: NodeTemplate | undefined;
            try { template = await fetchNodeTemplate(item.path); } catch (_err) { /* ignore */ }
            await insertAndConnect(item, mid, template, (id) => {
              const connects: Connection[] = [];
              connects.push({ source: String(params.source), sourceHandle: params.sourceHandle, target: id, targetHandle: "in-0" } as any);
              connects.push({ source: String(params.source), sourceHandle: params.sourceHandle, target: id, targetHandle: "in-1" } as any);
              if (dstType === "float3" || dstType === "float4") connects.push({ source: String(params.source), sourceHandle: params.sourceHandle, target: id, targetHandle: "in-2" } as any);
              if (dstType === "float4") connects.push({ source: String(params.source), sourceHandle: params.sourceHandle, target: id, targetHandle: "in-3" } as any);
              connects.push({ source: id, sourceHandle: "out-0", target: String(params.target), targetHandle: params.targetHandle } as any);
              setEdges((eds) => ensureColoredEdges(connects.reduce((acc, c) => connectSingleInputEdge(acc, c), eds), nodesRef.current));
            });
          })();
          return;
        }
      }

      // 3) vec4 -> vec3 (drop alpha) or vec3 -> vec4 (alpha=1)
      if ((srcType === "float4" && dstType === "float3") || (srcType === "float3" && dstType === "float4")) {
        const combineKey = srcType === "float4" && dstType === "float3" ? "combine3" : "combine4";
        const item = paletteGet(combineKey);
        if (item) {
          (async () => {
            let template: NodeTemplate | undefined;
            try { template = await fetchNodeTemplate(item.path); } catch (_err) { /* ignore */ }
            await insertAndConnect(item, mid, template, (id) => {
              const connects: Connection[] = [];
              // Connect src to x,y,z; for vec4->vec3 we drop w, for vec3->vec4 w uses default=1
              connects.push({ source: String(params.source), sourceHandle: params.sourceHandle, target: id, targetHandle: "in-0" } as any);
              connects.push({ source: String(params.source), sourceHandle: params.sourceHandle, target: id, targetHandle: "in-1" } as any);
              connects.push({ source: String(params.source), sourceHandle: params.sourceHandle, target: id, targetHandle: "in-2" } as any);
              connects.push({ source: id, sourceHandle: "out-0", target: String(params.target), targetHandle: params.targetHandle } as any);
              setEdges((eds) => ensureColoredEdges(connects.reduce((acc, c) => connectSingleInputEdge(acc, c), eds), nodesRef.current));
            });
          })();
          return;
        }
      }

      console.warn("Type mismatch: blocking connection", params);
      return;
    }
    setEdges((eds) => {
      const nextRaw = connectSingleInputEdge(eds, params);
      const next = ensureColoredEdges(nextRaw, nodesRef.current);
      // annotate dashed edges when either endpoint is an editor node
      const isEditorNode = (id: string) => {
        const n = nodesById.get(id);
        const meta: any[] = Array.isArray((n?.data as any)?.template?.meta) ? (n!.data as any).template.meta : [];
        return meta.includes("editor_node");
      };
      if (params.source && params.target && (isEditorNode(params.source) || isEditorNode(params.target))) {
        const edgeId = `e${params.source}-${params.target}-${params.sourceHandle}-${params.targetHandle}`;
        return next.map((e) => (e.id === edgeId ? { ...e, style: { ...(e.style ?? {}), strokeDasharray: "4 3" } } : e));
      }
      return next;
    });
  };

  const paletteByType = useMemo(() => {
    const map = new Map<string, NodePaletteItem>();
    if (palette) {
      for (const item of palette.flat ?? []) {
        map.set(item.type, item);
      }
    }
    return map;
  }, [palette]);

  const templateCacheRef = useRef<TemplateCache | null>(null);
  if (!templateCacheRef.current) {
    templateCacheRef.current = createTemplateCache(fetchNodeTemplate);
  }
  useEffect(() => {
    templateCacheRef.current?.reset();
  }, [paletteByType]);

  const loadTemplateDefaults = useCallback(
    async (type: string): Promise<NodeTemplate | undefined> => {
      if (!type) return undefined;
      const item = paletteByType.get(type);
      if (!item) return undefined;
      const cache = templateCacheRef.current;
      if (!cache) return undefined;
      try {
        return await cache.load(type, item.path);
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

  // helper to build a filtered palette
  const buildFilteredPalette = useCallback((items: NodePaletteItem[]): NodePalette => {
    const byCategory = new Map<string, NodePaletteItem[]>();
    for (const it of items) {
      const list = byCategory.get(it.category) ?? [];
      list.push(it);
      byCategory.set(it.category, list);
    }
    const categories = Array.from(byCategory.entries()).map(([name, nodes]) => ({ name, nodes }));
    return { categories, flat: items };
  }, []);

  // load and cache pin type indices for a node palette item
  const loadPinIndex = useCallback(async (item: NodePaletteItem): Promise<{ inputs: ReturnType<typeof normalizePinType>[]; outputs: ReturnType<typeof normalizePinType>[] }> => {
    const cached = pinIndexCacheRef.current.get(item.type);
    if (cached) return cached;
    let tpl: NodeTemplate | undefined;
    try { tpl = await fetchNodeTemplate(item.path); } catch (_err) { /* ignore */ }
    const read = (arr: any[] | undefined) => {
      const pins: any[] = Array.isArray(arr) ? arr : [];
      const types: ReturnType<typeof normalizePinType>[] = [];
      for (let i = 0; i < pins.length; i++) {
        const p = pins[i];
        if (!p || typeof p !== "object") continue;
        types.push(normalizePinType((p as any).type));
      }
      return types;
    };
    const entry = { inputs: read(tpl?.inputs as any), outputs: read(tpl?.outputs as any) };
    pinIndexCacheRef.current.set(item.type, entry);
    return entry;
  }, []);

  const nodesRef = useRef<Node[]>(nodes);
  useLayoutEffect(() => { nodesRef.current = nodes; }, [nodes]);
  const edgesRef = useRef<Edge[]>(edges);
  useLayoutEffect(() => { edgesRef.current = edges; }, [edges]);
  const graphNameRef = useRef(graphName);
  useLayoutEffect(() => { graphNameRef.current = graphName; }, [graphName]);

  const ensureColoredEdges = useCallback((list: Edge[], nodesOverride?: Node[]): Edge[] => {
    const nodesNow = (nodesOverride ?? (nodesRef.current as any as Node[])) as any as Node[];
    return list.map((e) => {
      const typed = (e && (e as any).type) ? e : ({ ...e, type: "colored" as any } as any);
      const srcRaw = (e as any)?.data?.sourceType;
      const dstRaw = (e as any)?.data?.targetType;
      const srcType = (srcRaw !== undefined)
        ? normalizePinType(srcRaw)
        : ((e?.source && e?.sourceHandle) ? getSourceType(nodesNow as any, e as any) : undefined);
      const dstType = (dstRaw !== undefined)
        ? normalizePinType(dstRaw)
        : ((e?.target && e?.targetHandle) ? getTargetType(nodesNow as any, e as any) : undefined);
      if (srcType || dstType) {
        return { ...typed, data: { ...(typed as any).data, sourceType: srcType, targetType: dstType } } as any;
      }
      return typed;
    });
  }, []);

  // Backfill existing edges (from older sessions) with colored type and pin types
  useEffect(() => {
    setEdges((prev) => {
      let needsUpdate = false;
      for (const e of prev) {
        if (!(e as any).type || !(e as any).data || !(e as any).data.sourceType || !(e as any).data.targetType) {
          needsUpdate = true;
          break;
        }
      }
      return needsUpdate ? ensureColoredEdges(prev, nodesRef.current) : prev;
    });
  }, [ensureColoredEdges, setEdges, nodes]);

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
    setRecentGraphsInitialized(true);
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
  const draggingNodeIdsRef = useRef(new Set<string>());

  const recomputeGraphData = useCallback(() => {
    const next = buildGraphData(nodesRef.current as any, edgesRef.current as any, graphNameRef.current);
    setGraphData(next as any);
  }, []);

  useEffect(() => {
    if (resizingEditorIdsRef.current.size > 0 || draggingNodeIdsRef.current.size > 0) {
      pendingGraphUpdateRef.current = true;
      return;
    }
    pendingGraphUpdateRef.current = false;
    recomputeGraphData();
  }, [nodes, edges, graphName, recomputeGraphData]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const pendingSizeUpdates: Array<{ id: string; width?: number; height?: number }> = [];
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
          const readDimension = (key: "width" | "height"): number | undefined => {
            const dims = change.dimensions;
            const dimVal = dims ? (dims as any)[key] : undefined;
            if (typeof dimVal === "number" && Number.isFinite(dimVal)) return Math.round(dimVal);
            if (!node) return undefined;
            const styleVal = (node as any)?.style?.[key];
            if (typeof styleVal === "number" && Number.isFinite(styleVal)) return Math.round(styleVal);
            if (typeof styleVal === "string") {
              const parsed = Number.parseFloat(styleVal);
              if (Number.isFinite(parsed)) return Math.round(parsed);
            }
            const direct = (node as any)?.[key];
            if (typeof direct === "number" && Number.isFinite(direct)) return Math.round(direct);
            const dimensionVal = (node as any)?.dimensions?.[key];
            if (typeof dimensionVal === "number" && Number.isFinite(dimensionVal)) return Math.round(dimensionVal);
            const measured = (node as any)?.measured?.[key];
            if (typeof measured === "number" && Number.isFinite(measured)) return Math.round(measured);
            return undefined;
          };
          const width = readDimension("width");
          const height = readDimension("height");
          if (Number.isFinite(width) || Number.isFinite(height)) {
            const next: { id: string; width?: number; height?: number } = { id: change.id };
            if (typeof width === "number" && Number.isFinite(width)) next.width = width;
            if (typeof height === "number" && Number.isFinite(height)) next.height = height;
            pendingSizeUpdates.push(next);
          }
        }
      }
      if (pendingSizeUpdates.length) {
        const updates = new Map<string, { width?: number; height?: number }>();
        pendingSizeUpdates.forEach((entry) => {
          const next: { width?: number; height?: number } = {};
          if (typeof entry.width === "number" && Number.isFinite(entry.width)) next.width = entry.width;
          if (typeof entry.height === "number" && Number.isFinite(entry.height)) next.height = entry.height;
          updates.set(entry.id, next);
        });
        setNodes((prev) =>
          prev.map((n) => {
            const entry = updates.get(n.id);
            if (!entry) return n;
            const tpl = (n.data as any)?.template;
            if (!tpl || !Array.isArray(tpl.meta) || !tpl.meta.includes("editor_node")) return n;
            const meta = [...tpl.meta];
            const currentSize = parseEditorSize(meta as string[]);
            const nextWidthRaw = Number.isFinite(entry.width) ? entry.width! : currentSize.width;
            const nextHeightRaw = Number.isFinite(entry.height) ? entry.height! : currentSize.height;
            if (!Number.isFinite(nextWidthRaw) || !Number.isFinite(nextHeightRaw)) return n;
            const nextWidth = Math.max(0, Math.round(nextWidthRaw!));
            const nextHeight = Math.max(0, Math.round(nextHeightRaw!));
            const formatted = `editor_size:${nextWidth}x${nextHeight}`;
            const idx = meta.findIndex((m: any) => typeof m === "string" && m.startsWith("editor_size:"));
            let metaChanged = false;
            if (idx >= 0) {
              if (meta[idx] !== formatted) {
                meta[idx] = formatted;
                metaChanged = true;
              }
            } else {
              meta.push(formatted);
              metaChanged = true;
            }
            const nextTpl = metaChanged ? { ...tpl, meta } : tpl;
            const style = { ...(n.style ?? {}) } as Record<string, unknown>;
            let styleChanged = false;
            if (style.width !== nextWidth) {
              style.width = nextWidth;
              styleChanged = true;
            }
            if (style.height !== nextHeight) {
              style.height = nextHeight;
              styleChanged = true;
            }
            if (!metaChanged && !styleChanged) return n;
            const nextNode: any = {
              ...n,
              data: { ...(n.data as any), template: nextTpl },
            };
            if (styleChanged) nextNode.style = style;
            return nextNode;
          })
        );
      }
      onNodesChange(changes);
    },
    [onNodesChange, recomputeGraphData, setNodes]
  );

  // Visible graph based on current viewPath (root vs. inside a group)
  const currentParentId = viewPath.length ? viewPath[viewPath.length - 1] : undefined;
  const visibleNodes = useMemo(() => {
    const base = prepareVisibleNodes(nodes as any, currentParentId) as any;
    if (!showCompileOnly) return base;
    return base.filter((n: any) => {
      const meta: any[] = Array.isArray((n.data as any)?.template?.meta) ? (n.data as any).template.meta : [];
      return !meta.includes("editor_node");
    });
  }, [nodes, currentParentId, showCompileOnly]);
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n: any) => n.id)), [visibleNodes]);
  const visibleEdges = useMemo(() => {
    const filtered = edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));
    return ensureColoredEdges(filtered, nodesRef.current);
  }, [edges, visibleNodeIds, ensureColoredEdges]);

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

  const updateNodeAsset = useCallback((id: string, asset: NodeAssetPayload | null) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        const nextData = { ...(n.data as any) };
        if (asset && asset.id && asset.source) {
          nextData.asset = { ...asset };
        } else {
          delete nextData.asset;
        }
        return { ...n, data: nextData } as any;
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
      updateNodeAsset,
    }),
    [updateNodeInputValue, updateNodePropertyValue, updateNodeLabel, addNodeMeta, removeNodeMeta, updateNodeAsset]
  );

  const nodesById = useMemo(() => {
    const map = new Map<string, Node>();
    for (const node of nodes) map.set(node.id, node);
    return map;
  }, [nodes]);

  const selectedCount = useMemo(() => nodes.filter((node) => node.selected).length, [nodes]);

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

      if (template) templateCacheRef.current?.prime(type, template);

      const nextId = String(++idCounter.current);
      const parentNode = currentParentId ? rf.getNode(currentParentId) : undefined;
      const parentPosition = (() => {
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

  const inflateAndLoadGraph = useCallback(
    async (graph: CanonicalNode, label: string) => {
      const { graph: inflatedGraph, defaults } = await inflateGraph(graph, loadTemplateDefaults);
      const rootCandidate: any = inflatedGraph as any;
      const rootGraph: CanonicalNode = (!rootCandidate?.type || rootCandidate.type === "") && Array.isArray(rootCandidate?.nodes)
        ? (rootCandidate.nodes.find((n: any) => n?.type === "surface") ?? rootCandidate.nodes[0])
        : (inflatedGraph as any);

      const assetRegistry = await loadAssetRegistry();

      const buildResult = buildReactFlowGraph({
        root: rootGraph as any,
        defaults,
        assets: assetRegistry,
        options: { nodeDefaults },
      });

      idCounter.current = buildResult.maxId;
      resizingEditorIdsRef.current.clear();
      pendingGraphUpdateRef.current = false;

      setNodes(attachNodesUpdateApi(buildResult.nodes as any, nodeUpdaterApi) as any);
      setEdges(ensureColoredEdges(buildResult.edges, buildResult.nodes as any));
      setGraphName(label ?? "UntitledGraph");
      setViewPath(buildResult.defaultViewPath);
      // Request a one-time fitView after nodes render for this load
      fitAfterLoadRef.current = true;
    },
    [loadTemplateDefaults, nodeUpdaterApi, setEdges, setGraphName, setNodes, setViewPath, ensureColoredEdges]
  );

  const loadExampleGraph = useCallback(async (ex: { key: string; label: string }) => {
    try {
      const url = new URL("/api/example-graphs", location.origin);
      url.searchParams.set("name", ex.key);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const graph = data.graph as CanonicalNode;
      await inflateAndLoadGraph(graph, ex.label ?? "UntitledGraph");
    } catch (err) {
      console.warn("Failed to load example graph", ex, err);
    }
  }, [inflateAndLoadGraph]);

  // File save/open helpers (.osg JSON)
  const serializeGraph = useCallback(
    (overrideName?: string) => {
      const name = overrideName && overrideName.trim().length ? overrideName.trim() : graphName;
      const data = serializeGraphForSave(nodes as any, edges as any, name);
      return JSON.stringify(data, null, 2);
    },
    [nodes, edges, graphName]
  );

  const ensureReadWritePermission = useCallback(async (handle: any): Promise<boolean> => {
    if (!handle || typeof handle !== "object") return false;
    const query = typeof handle.queryPermission === "function" ? handle.queryPermission.bind(handle) : null;
    const request = typeof handle.requestPermission === "function" ? handle.requestPermission.bind(handle) : null;
    if (!query || !request) return true;
    try {
      const status = await query({ mode: "readwrite" });
      if (status === "granted") return true;
      if (status === "denied") return false;
      const next = await request({ mode: "readwrite" });
      return next === "granted";
    } catch (_err) {
      return true;
    }
  }, []);

  const rememberRecentGraph = useCallback(
    (name: string, contents: string, handle?: FileSystemFileHandle | null) => {
      setRecentGraphs(saveRecentGraph({ name, contents }));
      if (handle === undefined) return;
      const persist = async () => {
        if (handle) {
          await saveRecentGraphHandle(name, handle);
        } else {
          await removeRecentGraphHandle(name);
        }
      };
      void persist();
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
      if (remember) rememberRecentGraph(safeName, contents, handle ?? null);
    },
    [inflateAndLoadGraph, rememberRecentGraph]
  );

  // Unified startup loader: session (temp/disk) -> recent graph -> examples
  useEffect(() => {
    if (initialLoadDoneRef.current || startupAttemptedRef.current || !recentGraphsInitialized) return;
    const tryStartup = async () => {
      let attempted = false;
      // 1) Try restoring last session (unsaved temp or disk)
      try {
        if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
          const raw = window.localStorage.getItem(SESSION_GRAPH_KEY);
          if (raw && raw.trim().length) {
            const session = JSON.parse(raw) as { kind?: string; name?: string; contents?: string };
            const name = typeof session?.name === "string" && session.name.trim().length ? session.name.trim() : "UntitledGraph.osg";
            const contents = typeof session?.contents === "string" ? session.contents : "";
            if (contents && contents.trim().length) {
              // Validate that the stored graph has content (at least one node)
              try {
                const parsed = JSON.parse(contents);
                const hasNodes = Array.isArray(parsed?.nodes) && parsed.nodes.length > 0;
                if (!hasNodes) {
                  // Skip restoring empty session graphs
                  throw new Error("empty-session-graph");
                }
              } catch (_e) {
                // Invalid or empty; do not restore from session
                throw new Error("skip-session");
              }
              if (session?.kind === "disk") {
                const handle = await loadRecentGraphHandle(name);
                await openGraphFromContents({ name, contents, handle: handle ?? undefined });
              } else {
                await openGraphFromContents({ name, contents });
              }
              initialLoadDoneRef.current = true;
              attempted = true;
            }
          }
        }
      } catch (_err) {
        // Ignore session restore errors and continue
      }

      // 2) Fallback to most recent graph entry if session didn't restore
      if (!attempted && recentGraphs.length) {
        try {
          const entry = recentGraphs[0]!;
          const handle = await loadRecentGraphHandle(entry.name);
          await openGraphFromContents({ name: entry.name, contents: entry.contents, handle: handle ?? undefined });
          initialLoadDoneRef.current = true;
          attempted = true;
        } catch (err) {
          console.warn("Failed to open recent graph during initial load", recentGraphs[0]?.name, err);
          setRecentGraphs(removeRecentGraph(recentGraphs[0]!.name));
          void removeRecentGraphHandle(recentGraphs[0]!.name);
        }
      }

      // Mark that we've decided; example loader will run only if not loaded
      startupAttemptedRef.current = true;
    };
    void tryStartup();
  }, [recentGraphsInitialized, recentGraphs, openGraphFromContents, setRecentGraphs]);

  const writeFileHandle = useCallback(async (handle: any, contents: string) => {
    try {
      const permitted = await ensureReadWritePermission(handle);
      if (!permitted) throw new Error("write-permission-denied");
      const writable = await handle.createWritable();
      await writable.write(contents);
      await writable.close();
    } catch (err) {
      console.warn("Failed to write file", err);
      throw err;
    }
  }, [ensureReadWritePermission]);

  const handleSaveAs = useCallback(async () => {
    try {
      const suggested = (graphName || "UntitledGraph").replace(/\s+/g, "_") + ".osg";
      const supportsPicker = typeof (window as any).showSaveFilePicker === "function";
      if (supportsPicker) {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: suggested,
          types: [{ description: "OpenShaderGraph (*.osg)", accept: { "application/json": [".osg"] } }],
        });
        const targetName = handle?.name || suggested;
        const label = (() => {
          const stripped = typeof targetName === "string" ? targetName.replace(/\.[^.]+$/, "").trim() : "";
          return stripped.length ? stripped : (graphName.trim().length ? graphName : "UntitledGraph");
        })();
        const contents = serializeGraph(label);
        await writeFileHandle(handle, contents);
        fileHandleRef.current = handle;
        setFileName(targetName);
        setGraphName(label);
        rememberRecentGraph(targetName, contents, handle);
      } else {
        const label = (() => {
          const stripped = suggested.replace(/\.[^.]+$/, "").trim();
          return stripped.length ? stripped : (graphName.trim().length ? graphName : "UntitledGraph");
        })();
        const contents = serializeGraph(label);
        triggerDownload(suggested, contents);
        fileHandleRef.current = null;
        setFileName(suggested);
        setGraphName(label);
        rememberRecentGraph(suggested, contents, null);
      }
    } catch (_err) {
      // user cancel or error: ignore
    }
  }, [graphName, serializeGraph, rememberRecentGraph, writeFileHandle]);

  const handleSave = useCallback(async () => {
    const handle = fileHandleRef.current;
    if (handle) {
      try {
        const targetFileName = (fileName && fileName.trim().length ? fileName.trim() : handle.name) || "UntitledGraph.osg";
        const label = (() => {
          const stripped = targetFileName.replace(/\.[^.]+$/, "").trim();
          if (stripped.length) return stripped;
          const fallback = graphName.trim();
          return fallback.length ? fallback : "UntitledGraph";
        })();
        const contents = serializeGraph(label);
        await writeFileHandle(handle, contents);
        setGraphName(label);
        rememberRecentGraph(targetFileName, contents, handle);
        return;
      } catch (_err) {
        // Fallback to Save As on failure
      }
    }
    await handleSaveAs();
  }, [fileName, graphName, serializeGraph, writeFileHandle, handleSaveAs, rememberRecentGraph]);

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
        const handle = await loadRecentGraphHandle(entry.name);
        await openGraphFromContents({ name: entry.name, contents: entry.contents, handle: handle ?? undefined });
      } catch (err) {
        console.warn("Failed to open recent graph", entry.name, err);
        setRecentGraphs(removeRecentGraph(entry.name));
        void removeRecentGraphHandle(entry.name);
      }
    },
    [openGraphFromContents, setRecentGraphs]
  );

  const handleClearRecent = useCallback(() => {
    for (const entry of recentGraphs) {
      void removeRecentGraphHandle(entry.name);
    }
    setRecentGraphs(clearRecentGraphs());
  }, [recentGraphs, setRecentGraphs]);

  // Lightweight autosave of current session (supports restoring unsaved graphs)
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") return;
    if (!startupAttemptedRef.current || !initialLoadDoneRef.current) return;
    if (!nodesRef.current.length) return;
    try {
      const label = (() => {
        const trimmed = (graphName || "UntitledGraph").trim();
        return trimmed.length ? trimmed : "UntitledGraph";
      })();
      const name = (fileName && fileName.trim().length ? fileName : `${label.replace(/\s+/g, "_")}.osg`);
      const contents = serializeGraph(label);
      const kind = fileHandleRef.current ? "disk" : "temp";
      window.localStorage.setItem(SESSION_GRAPH_KEY, JSON.stringify({ kind, name, contents }));
    } catch (_err) {
      // Ignore autosave failures
    }
  }, [nodes, edges, graphName, fileName, serializeGraph]);

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
        const previewTpl = await loadTemplateDefaults("editor_preview");
        if (!surfaceTpl || !vpassTpl || !fpassTpl || !voutTpl || !foutTpl) {
          console.warn("Missing required templates for new graph");
          return;
        }

        const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
        const surface = deepClone(surfaceTpl);
        const vertexPass = deepClone(vpassTpl);
        const fragmentPass = deepClone(fpassTpl);
        const vertexOutput = deepClone(voutTpl);
        const fragmentOutput = deepClone(foutTpl);
        const previewNode = previewTpl ? deepClone(previewTpl) : undefined;

        vertexPass.nodes = [vertexOutput];
        fragmentPass.nodes = [fragmentOutput];

        // Position preview panel next to fragment output if available
        // Use the same row (y) and push it to the right (x) so they appear side-by-side
        // Layout defaults come from buildReactFlowGraph: baseX=80, baseY=40, depthX=240
        // Children of fragment_pass are at depth=2 -> fallback x would be 80 + 2*240 = 560
        if (previewNode) {
          // Ensure meta array exists (editor node sizing comes from template meta)
          if (!Array.isArray(previewNode.meta)) previewNode.meta = [];
          previewNode.position = [560 + 170, 40];
          fragmentPass.nodes.push(previewNode as any);
        }

        const shadingProps: any[] = Array.isArray(fragmentOutput.properties)
          ? deepClone(fragmentOutput.properties as any[])
          : [];
        let shadingSet = false;
        for (let i = 0; i < shadingProps.length; i++) {
          const prop = shadingProps[i];
          if (prop && typeof prop === "object" && prop.id === "shading_model") {
            shadingProps[i] = { ...prop, value: shading };
            shadingSet = true;
            break;
          }
        }
        if (!shadingSet) shadingProps.push({ id: "shading_model", type: "enum", value: shading });
        fragmentOutput.properties = shadingProps as any;

        surface.nodes = [vertexPass, fragmentPass];

        let nextId = 1;
        const assignIds = (node: CanonicalNode) => {
          node.id = nextId++;
          for (const child of node.nodes ?? []) assignIds(child);
        };
        assignIds(surface as CanonicalNode);

        const defaults = new Map<number, NodeTemplate>();
        const captureDefaults = (node: CanonicalNode) => {
          defaults.set(node.id, deepClone(node) as any);
          for (const child of node.nodes ?? []) captureDefaults(child);
        };
        captureDefaults(surface as CanonicalNode);

        const buildResult = buildReactFlowGraph({
          root: surface as any,
          defaults,
          options: { nodeDefaults },
        });

        idCounter.current = buildResult.maxId;
        resizingEditorIdsRef.current.clear();
        pendingGraphUpdateRef.current = false;
        setNodes(attachNodesUpdateApi(buildResult.nodes as any, nodeUpdaterApi) as any);
        setEdges(ensureColoredEdges(buildResult.edges, buildResult.nodes as any));
        setGraphName(`Untitled ${shading.charAt(0).toUpperCase()}${shading.slice(1)}`);
        setViewPath(buildResult.defaultViewPath);
        // Request a one-time fitView after nodes render for this new graph
        fitAfterLoadRef.current = true;
      } catch (err) {
        console.warn("Failed to create new graph", shading, err);
      }
    },
    [paletteByType, loadTemplateDefaults, setNodes, setEdges, setGraphName, setViewPath, nodeUpdaterApi, ensureColoredEdges]
  );

  // Fetch example graphs and load the first by default (only if no recent graph was loaded)
  useEffect(() => {
    const abort = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/example-graphs", { signal: abort.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        const list: Array<{ key: string; label: string }> = Array.isArray(data.examples) ? data.examples : [];
        setExamples(list);
        if (startupAttemptedRef.current && !initialLoadDoneRef.current && list.length) {
          await loadExampleGraph(list[0]!);
          initialLoadDoneRef.current = true;
        }
      } catch (err: any) {
        if (isAbortError(err)) return;
        console.warn("Failed to load example graphs", err);
      }
    })();
    return () => abort.abort();
  }, [loadExampleGraph, recentGraphs, recentGraphsInitialized]);

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
    if (template) templateCacheRef.current?.prime(item.type, template);
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

    // If this node was added from a drag gesture, auto-connect first compatible opposite pin
    try {
      const drag = pendingConnectRef.current;
      pendingConnectRef.current = null;
      const tpl: any = (rfNode as any)?.data?.template;
      if (!drag || !tpl) return;
      const findFirstMatchingPinIndex = (
        pins: any[] | undefined,
        isFromSource: boolean,
        draggedType: ReturnType<typeof normalizePinType>
      ): number => {
        const list = Array.isArray(pins) ? pins : [];
        for (let i = 0; i < list.length; i++) {
          const p = list[i];
          if (!p || typeof p !== "object") continue;
          const t = normalizePinType((p as any).type);
          if (isFromSource) {
            // dragging from an output; need input compatible with dragged -> candidate
            if (arePinTypesCompatible(draggedType, t)) return i;
          } else {
            // dragging from an input; need output compatible with candidate -> dragged
            if (arePinTypesCompatible(t, draggedType)) return i;
          }
        }
        return -1;
      };
      const isFromSource = drag.side === "source";
      const idx = isFromSource
        ? findFirstMatchingPinIndex(tpl?.inputs as any, true, drag.type)
        : findFirstMatchingPinIndex(tpl?.outputs as any, false, drag.type);
      if (idx < 0) return;
      const readPinId = (pins: any[] | undefined, index: number): string => {
        const list = Array.isArray(pins) ? pins : [];
        const p = list[index];
        const idVal = typeof (p?.id) === "number" ? p.id : index;
        return String(idVal);
      };
      const newHandle = isFromSource
        ? (`in-${readPinId(tpl?.inputs as any, idx)}`)
        : (`out-${readPinId(tpl?.outputs as any, idx)}`);
      const newPinType = isFromSource
        ? normalizePinType(((tpl?.inputs as any[])[idx] as any)?.type)
        : normalizePinType(((tpl?.outputs as any[])[idx] as any)?.type);
      const connData = isFromSource
        ? { sourceType: drag.type, targetType: newPinType }
        : { sourceType: newPinType, targetType: drag.type };
      const conn: Connection = isFromSource
        ? ({ source: drag.nodeId, sourceHandle: drag.handleId, target: nextId, targetHandle: newHandle, data: connData } as any)
        : ({ source: nextId, sourceHandle: newHandle, target: drag.nodeId, targetHandle: drag.handleId, data: connData } as any);
      setEdges((eds) => ensureColoredEdges(connectSingleInputEdge(eds, conn), nodesRef.current));
    } catch (_err) {
      // ignore auto-connect failures
    }
  };

  const openAddNodeMenuAt = useCallback((x: number, y: number, override: NodePalette | null) => {
    setMenuPaletteOverride(override);
    setMenu({ open: true, kind: "background", x, y });
  }, []);

  const openFilteredAddMenuForDrag = useCallback(async (client: { x: number; y: number }) => {
    const drag = connectDragRef.current;
    connectDragRef.current = null;
    if (!drag) return;
    // remember for auto-connect when node is added
    pendingConnectRef.current = drag;
    if (!palette) {
      openAddNodeMenuAt(client.x, client.y, null);
      return;
    }
    const draggedType = drag.type;
    const fromSource = drag.side === "source";
    const items = palette.flat;
    const results: NodePaletteItem[] = [];
    await Promise.all(
      items.map(async (it) => {
        const idx = await loadPinIndex(it);
        if (fromSource) {
          // dragging from an output; candidate must have a compatible input
          if (idx.inputs.some((t) => arePinTypesCompatible(draggedType, t))) results.push(it);
        } else {
          // dragging from an input; candidate must have a compatible output
          if (idx.outputs.some((t) => arePinTypesCompatible(t, draggedType))) results.push(it);
        }
      })
    );
    const filtered = buildFilteredPalette(results);
    openAddNodeMenuAt(client.x, client.y, filtered);
  }, [palette, loadPinIndex, buildFilteredPalette, openAddNodeMenuAt]);

  const deleteNodeById = useCallback(
    async (id: string) => {
      const node = nodesById.get(id);
      if (node && (node as any).deletable === false) return; // protect mandatory IO nodes
      const removed = new Set<string>([id]);
      const dependents = nodesRef.current
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
    [loadTemplateDefaults, nodeUpdaterApi, nodesById, setEdges, setNodes]
  );

  // Group selected nodes into a new container node with dynamic I/O
  const groupSelected = () => {
    const selected = nodesRef.current.filter((n) => n.selected);
    if (!selected.length) return;
    const selectedIds = new Set(selected.map((n) => n.id));
    const idGen = () => String(++idCounter.current);
    const res = utilGroupSelected(nodes as any, edges as any, selectedIds, idGen);
    setNodes(attachNodesUpdateApi(res.nodes as any, nodeUpdaterApi) as any);
    setEdges(ensureColoredEdges(res.edges as any, res.nodes as any));
  };

  // Ungroup a group node: move children out, restore external edges, remove group + IO nodes
  const ungroupGroup = (groupId: string) => {
    const res = utilUngroupGroup(nodes as any, edges as any, groupId);
    setNodes(attachNodesUpdateApi(res.nodes as any, nodeUpdaterApi) as any);
    setEdges(ensureColoredEdges(res.edges as any, res.nodes as any));
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
              <MenubarItem
                data-state={showCompileOnly ? "checked" : "unchecked"}
                onClick={() => setShowCompileOnly((v) => !v)}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    {showCompileOnly ? (
                      <Check aria-hidden="true" className="h-3 w-3" />
                    ) : (
                      <span aria-hidden="true" className="inline-block h-3 w-3" />
                    )}
                    <span>Compile-only view</span>
                  </span>
                </div>
              </MenubarItem>
              <MenubarSeparator />
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
              const n = nodes.find((nn) => (nn as any).id === id);
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

  // After a graph is loaded/created and the view path is applied, fit the viewport to visible nodes once
  useEffect(() => {
    if (!fitAfterLoadRef.current) return;
    if (!visibleNodes.length) return;
    // Defer to ensure nodes are mounted and measured
    const run = () => {
      try {
        fitAfterLoadRef.current = false;
        rf.fitView({
          padding: 0.12,
          includeHiddenNodes: false,
          nodes: visibleNodes.map((n: any) => ({ id: n.id })),
        } as any);
      } catch (_err) {
        // ignore
        fitAfterLoadRef.current = false;
      }
    };
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(run);
    } else {
      setTimeout(run, 0);
    }
  }, [rf, visibleNodes, currentParentId]);

  return (
    <GraphStateProvider value={graphStateValue}>
      <AppShell header={Header}>
        <div ref={flowContainerRef} className="w-full h-full relative">
          <ReactFlow
          nodes={visibleNodes}
          edges={visibleEdges}
          nodeTypes={{ graphNode: GraphNode }}
          edgeTypes={{ colored: ColoredEdge as any }}
          defaultEdgeOptions={{ type: "colored" as any }}
          isValidConnection={(conn) => isConnectionCompatible(nodesRef.current as any, conn)}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={(e: any, params: any) => {
            try {
              const side = String(params?.handleType) === "source" ? "source" : "target";
              const nodeId = String(params?.nodeId ?? "");
              const handleId = String(params?.handleId ?? "");
              const t = getPinTypeFor(nodesRef.current as any, nodeId, handleId);
              connectDragRef.current = { side, nodeId, handleId, type: t } as any;
            } catch (_err) {
              connectDragRef.current = null;
            }
          }}
          onConnectEnd={(e: any) => {
            try {
              const target = e?.target as Element | null;
              const droppedOnHandle = !!(target && target.closest && target.closest(".react-flow__handle"));
              if (!droppedOnHandle) {
                const client = { x: e?.clientX ?? lastPointerRef.current?.x ?? 0, y: e?.clientY ?? lastPointerRef.current?.y ?? 0 };
                void openFilteredAddMenuForDrag(client);
                return;
              }
            } catch (_err) {
              // ignore
            } finally {
              connectDragRef.current = null;
            }
          }}
          onNodeDragStart={(_e, node) => {
            try {
              draggingNodeIdsRef.current.add(node.id);
              pendingGraphUpdateRef.current = true;
            } catch (_err) {
              // ignore
            }
          }}
          onNodeDragStop={(_e, node) => {
            try {
              draggingNodeIdsRef.current.delete(node.id);
              if (draggingNodeIdsRef.current.size === 0 && pendingGraphUpdateRef.current) {
                pendingGraphUpdateRef.current = false;
                const flush = () => recomputeGraphData();
                if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
                  window.requestAnimationFrame(flush);
                } else {
                  setTimeout(flush, 0);
                }
              }
            } catch (_err) {
              // ignore
            }
          }}
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
            setMenuPaletteOverride(null);
          }}
          onPaneContextMenu={(e) => {
            e.preventDefault();
            setMenuPaletteOverride(null);
            setMenu({ open: true, kind: "background", x: e.clientX, y: e.clientY });
          }}
          onSelectionContextMenu={(e) => {
            e.preventDefault();
            setMenuPaletteOverride(null);
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
            setMenuPaletteOverride(null);
            setMenu({ open: true, kind: "node", x: e.clientX, y: e.clientY, targetId: node.id });
          }}
          onEdgeContextMenu={(e, edge) => {
            e.preventDefault();
            setMenuPaletteOverride(null);
            setMenu({ open: true, kind: "edge", x: e.clientX, y: e.clientY, targetId: edge.id });
          }}
          fitView
        >
            <Background />
            <Controls className="rf-controls" position="bottom-left" />
            <MiniMap
              className="rf-minimap"
              position="bottom-right"
              nodeColor={mmColors.node}
              nodeStrokeColor={mmColors.stroke}
              maskColor={mmColors.mask}
            />
          </ReactFlow>
          <GraphContextMenu
          open={menu.open}
          kind={menu.kind}
          x={menu.x}
          y={menu.y}
          {...(menu.targetId ? { targetId: menu.targetId } : {})}
          {...((menuPaletteOverride ?? palette) ? { palette: (menuPaletteOverride ?? palette)! } : {})}
          expandAllCategories={Boolean(menuPaletteOverride)}
          selectedCount={selectedCount}
          onGroupSelected={() => {
            groupSelected();
            setMenu((m) => ({ ...m, open: false }));
            setMenuPaletteOverride(null);
          }}
          canUngroup={(() => {
            if (!menu.targetId) return false;
            const target = nodesById.get(menu.targetId);
            const type = (target?.data as any)?.template?.type ?? (target?.data as any)?.type;
            return type === "group";
          })()}
          onUngroupNode={(id) => {
            ungroupGroup(id);
            setMenu((m) => ({ ...m, open: false }));
            setMenuPaletteOverride(null);
          }}
          onAddNode={async (item) => {
            if (!item) return;
            await addNodeAt({ item, x: menu.x, y: menu.y });
            setMenu((m) => ({ ...m, open: false }));
            setMenuPaletteOverride(null);
            pendingConnectRef.current = null;
          }}
          onDeleteNode={async (id) => {
            if (!id) return;
            await deleteNodeById(id);
            setMenu((m) => ({ ...m, open: false }));
            setMenuPaletteOverride(null);
          }}
          onClose={() => { setMenu((m) => ({ ...m, open: false })); setMenuPaletteOverride(null); pendingConnectRef.current = null; }}
        />
        </div>
      </AppShell>
    </GraphStateProvider>
  );
}
export default App;
