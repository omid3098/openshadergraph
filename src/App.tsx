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
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { isConnectionCompatible, getSourceType, getTargetType, normalizePinType, getPinTypeFor, arePinTypesCompatible, getPinTypeOptionsFor } from "@/core/ui/compat";
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { GraphContextMenu, type ContextKind } from "./components/GraphContextMenu";
import { fetchNodePalette, fetchNodeTemplate } from "./core/schema/nodes";
import type { NodePalette, NodePaletteItem, NodeTemplate } from "./core/schema/types";
import { GraphNode } from "./components/GraphNode";
import ColoredEdge from "./components/ColoredEdge";
import { DocumentationPanel } from "./components/DocumentationPanel";
import { persistGet, persistSet } from "./lib/storage";
import { buildRFNodeFromTemplate, parseEditorSize } from "./core/ui/nodeFactory";
import {
  attachNodeUpdateApi,
  attachNodesUpdateApi,
  type NodeAssetPayload,
  type NodeUpdaterApi,
} from "./core/ui/nodeUpdaters";
import { GraphStateProvider } from "./core/ui/GraphStateContext";
import {
  SettingsProvider,
  type CurveMode,
  type ThemeName,
  type AssetLibrariesSettings,
  type ActionHotkeys,
} from "./ui/state/SettingsContext";
import { isAbortError } from "./lib/errors";
import { prepareVisibleNodes } from "./core/ui/visible";
import { buildGraphData } from "./core/ui/graphData";
import { serializeGraph as serializeGraphForSave, inflateGraph } from "./core/ui/graphSerde";
import { connectSingleInputEdge } from "./core/ui/edges";
import { createRerouteInsertion } from "./core/ui/reroute";
import {
  clearRecentGraphs,
  loadRecentGraphs,
  removeRecentGraph,
  saveRecentGraph,
  type RecentGraphEntry,
} from "./core/ui/recentGraphs";
import { loadRecentGraphHandle, removeRecentGraphHandle, saveRecentGraphHandle } from "./core/ui/recentGraphHandles";
import {
  getLastExportLanguage,
  loadExportHandle,
  removeExportHandle,
  saveExportHandle,
  setLastExportLanguage,
} from "./core/ui/exportHandles";
import { restoreInputsToDefaults } from "./core/ui/resetInputs";
import { ASSET_DRAG_MIME, parseAssetDragPayload } from "./core/assets/kind";
import { loadAssetRegistry } from "./core/assets/registry";
import { createTemplateCache, type TemplateCache } from "./core/ui/templateCache";
import { buildReactFlowGraph } from "./core/ui/reactFlowGraph";
import { alignSelectedNodes, distributeSelectedNodes, type AlignmentKind, type DistributionKind } from "@/core/ui/arrange";
import { computeDefaultPassLayout } from "./core/ui/layoutDefaults";
import { AppShell } from "./ui/layout/AppShell";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "./components/ui/breadcrumb";
import { Button } from "./components/ui/button";
import { Menubar, MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem, MenubarSeparator, MenubarSub, MenubarSubTrigger, MenubarSubContent } from "./components/ui/menubar";
import { SettingsPage } from "./ui/settings/SettingsPage";
import type { Graph } from "@/core/graph/types";
import { collectEditorNodes, computeEditorSpawnPosition, EDITOR_PANEL_TYPES, type EditorPanelKey } from "./core/ui/editorNodes";
import { Check, Github, BookOpen, Layers, Settings as SettingsIcon } from "lucide-react";
import { groupSelected as utilGroupSelected, ungroupGroup as utilUngroupGroup } from "./core/graph/grouping";
import { duplicateNodes, type DuplicateNodesResult } from "./core/graph/duplicate";
import { APP_VERSION_INFO } from "./version";
import {
  VIEW_MENU_ITEMS,
  isEditableHotkeyTarget,
  DEFAULT_QUICK_NODE_HOTKEYS,
  buildQuickHotkeyMap,
  normalizeQuickHotkeyList,
  formatQuickHotkeyDisplay,
  type QuickNodeHotkey,
} from "./core/ui/hotkeys";
import { isDragEnd, isDragStart, isResizeEnd, isResizeStart } from "./core/ui/historyGates";
import { useGraphHistory, type GraphActionMeta, type GraphHistoryApi, type GraphSnapshot } from "./core/ui/useGraphHistory";
import { useGraphHotkeys } from "./components/hooks/useGraphHotkeys";
import { useAutoFitOnViewPathChange } from "./core/ui/useAutoFitView";
import { cn } from "@/lib/utils";
import { applyDuplicateSelection } from "./core/ui/duplicateSelection";
import { createClipboardPayload, parseClipboardPayload, remapClipboardNodes, type ClipboardPayload } from "./core/ui/clipboard";
import { makeInHandle, makeOutHandle } from "./core/ui/handles";
import { apiFetch, resolveApiUrl } from "@/lib/api";

const IS_TEST_ENV =
  (typeof process !== "undefined" && process.env?.VITEST === "true") ||
  (typeof import.meta !== "undefined" && Boolean((import.meta as any).env?.VITEST));

const nodeDefaults = {
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
};

const initialNodes: Node[] = [];

const initialEdges: Edge[] = [];

const DEFAULT_ASSET_LIBRARIES: AssetLibrariesSettings = {
  ambientcg: { enabled: true },
};

function normalizeAssetLibraries(value?: AssetLibrariesSettings | null): AssetLibrariesSettings {
  return {
    ambientcg: {
      enabled: value?.ambientcg?.enabled !== false,
    },
  };
}

const DEFAULT_ACTION_HOTKEYS: ActionHotkeys = {
  quickExportCode: "KeyE",
};

function normalizeActionHotkeys(value?: ActionHotkeys | null): ActionHotkeys {
  const code = typeof value?.quickExportCode === "string" ? value.quickExportCode.trim() : "";
  const normalized = code.length ? code : DEFAULT_ACTION_HOTKEYS.quickExportCode;
  return { quickExportCode: normalized };
}

const ALIGNMENT_LABELS: Record<AlignmentKind, string> = {
  left: "Align Left",
  center: "Align Center",
  right: "Align Right",
  top: "Align Top",
  middle: "Align Middle",
  bottom: "Align Bottom",
};

const DISTRIBUTION_LABELS: Record<DistributionKind, string> = {
  horizontal: "Distribute Horizontally",
  vertical: "Distribute Vertically",
  "vertical-stack": "Stack Vertically",
  "horizontal-stack": "Stack Horizontally",
};

const DUPLICATE_OFFSET = { x: 32, y: 32 };
const PASTE_OFFSET = { x: 48, y: 48 };

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

type CommitGraphMutation = (meta: GraphActionMeta, mutator: () => void) => void;

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

function triggerTextDownload(name: string, contents: string, mime: string = "text/plain") {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function getInitialTheme(): ThemeName {
  if (typeof document !== "undefined") {
    if (document.documentElement.classList.contains("dark")) return "dark";
  }
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

function isCurveModeValue(value: unknown): value is CurveMode {
  return value === "default" || value === "smoothstep" || value === "step" || value === "straight" || value === "simplebezier";
}

type SidebarNavButtonProps = {
  icon: ReactNode;
  label: string;
  collapsed: boolean;
  active: boolean;
  onClick: () => void;
};

function SidebarNavButton({ icon, label, collapsed, active, onClick }: SidebarNavButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        collapsed ? "justify-center" : "justify-start",
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
      aria-pressed={active}
      onClick={onClick}
    >
      {icon}
      {!collapsed && <span>{label}</span>}
    </button>
  );
}

export function App() {
  const rf = useReactFlow();
  const [activeView, setActiveView] = useState<"graph" | "settings">("graph");
  const [theme, setThemeState] = useState<ThemeName>(() => getInitialTheme());
  const [curveMode, setCurveModeState] = useState<CurveMode>("default");
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [palette, setPalette] = useState<NodePalette | null>(null);
  const [quickNodeHotkeys, setQuickNodeHotkeysState] = useState<QuickNodeHotkey[]>(DEFAULT_QUICK_NODE_HOTKEYS);
  const [assetLibraries, setAssetLibrariesState] = useState<AssetLibrariesSettings>(DEFAULT_ASSET_LIBRARIES);
  const [actionHotkeys, setActionHotkeysState] = useState<ActionHotkeys>(DEFAULT_ACTION_HOTKEYS);
  const idCounter = useRef(0);
  const [viewPath, setViewPath] = useState<string[]>([]); // breadcrumb of nested groups
  const viewPathRef = useRef(viewPath);
  useLayoutEffect(() => { viewPathRef.current = viewPath; }, [viewPath]);
  const [graphName, setGraphName] = useState<string>("UntitledGraph");
  const getGraphLabelKey = useCallback((): string => {
    const trimmed = (graphName || "").trim();
    return trimmed.length ? trimmed : "UntitledGraph";
  }, [graphName]);
  const [examples, setExamples] = useState<Array<{ key: string; label: string }>>([]);
  const [languages, setLanguages] = useState<Array<{ key: string; name: string; path: string }>>([]);
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
  const [clipboardStatus, setClipboardStatus] = useState<{ kind: "success" | "error"; message: string; key: number } | null>(null);
  const [canPasteFromClipboard, setCanPasteFromClipboard] = useState(false);
  const [showDocsPanel, setShowDocsPanel] = useState<boolean>(false);
  const [docsWidth, setDocsWidth] = useState<number>(768);
  const docsResizing = useRef(false);
  const docsStartX = useRef(0);
  const docsStartW = useRef(0);
  const [isDocsResizing, setIsDocsResizing] = useState(false);
  const clipboardStatusTimerRef = useRef<number | null>(null);
  const [quickExportLanguage, setQuickExportLanguage] = useState<string | null>(null);
  const [canQuickExport, setCanQuickExport] = useState(false);
  const quickExportHandleRef = useRef<FileSystemFileHandle | null>(null);
  const quickExportLanguageRef = useRef<string | null>(null);
  const setQuickExportState = useCallback(
    (handle: FileSystemFileHandle | null, language: string | null) => {
      quickExportHandleRef.current = handle;
      quickExportLanguageRef.current = language;
      setQuickExportLanguage(language);
      setCanQuickExport(Boolean(handle && language));
    },
    []
  );
  const quickHotkeysPersistReadyRef = useRef(false);
  const fileSystemAccessSupported =
    typeof window !== "undefined" && typeof (window as any).showSaveFilePicker === "function";
  const flowContainerRef = useRef<HTMLDivElement | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const initialLoadDoneRef = useRef(false);
  const startupAttemptedRef = useRef(false);
  const fitAfterLoadRef = useRef(false);
  const connectDragRef = useRef<{ side: "source" | "target"; nodeId: string; handleId: string; type: ReturnType<typeof normalizePinType> } | null>(null);
  const connectCompletedRef = useRef(false);
  const pendingConnectRef = useRef<{ side: "source" | "target"; nodeId: string; handleId: string; type: ReturnType<typeof normalizePinType> } | null>(null);
  const pinIndexCacheRef = useRef<Map<string, { inputs: ReturnType<typeof normalizePinType>[]; outputs: ReturnType<typeof normalizePinType>[] }>>(new Map());
  const dragSnapshotRef = useRef<GraphSnapshot | null>(null);
  const resizeSnapshotRef = useRef<GraphSnapshot | null>(null);
  const captureSnapshotFnRef = useRef<(() => GraphSnapshot) | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await persistGet<string>("ui.theme");
      if (cancelled) return;
      if (saved === "dark" || saved === "light") {
        setThemeState(saved);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useLayoutEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
  }, [theme]);

  useEffect(() => {
    void persistSet("ui.theme", theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await persistGet<string>("ui.curveMode");
      if (cancelled) return;
      if (isCurveModeValue(stored)) {
        setCurveModeState(stored);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    void persistSet("ui.curveMode", curveMode);
  }, [curveMode]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await persistGet<QuickNodeHotkey[]>("ui.quickNodeHotkeys");
      if (cancelled) return;
      if (Array.isArray(stored)) {
        setQuickNodeHotkeysState(normalizeQuickHotkeyList(stored as QuickNodeHotkey[]));
      }
      quickHotkeysPersistReadyRef.current = true;
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!quickHotkeysPersistReadyRef.current) return;
    void persistSet("ui.quickNodeHotkeys", quickNodeHotkeys);
  }, [quickNodeHotkeys]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await persistGet<AssetLibrariesSettings>("ui.assetLibraries");
      if (cancelled || !stored) return;
      setAssetLibrariesState(normalizeAssetLibraries(stored));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void persistSet("ui.assetLibraries", assetLibraries);
  }, [assetLibraries]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await persistGet<ActionHotkeys>("ui.actionHotkeys");
      if (cancelled || !stored) return;
      setActionHotkeysState(normalizeActionHotkeys(stored));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void persistSet("ui.actionHotkeys", actionHotkeys);
  }, [actionHotkeys]);

  const setQuickNodeHotkeys = useCallback(
    (next: QuickNodeHotkey[] | ((prev: QuickNodeHotkey[]) => QuickNodeHotkey[])) => {
      setQuickNodeHotkeysState((prev) => {
        const updated = typeof next === "function" ? (next as (prev: QuickNodeHotkey[]) => QuickNodeHotkey[])(prev) : next;
        const normalized = normalizeQuickHotkeyList(Array.isArray(updated) ? updated : []);
        if (
          normalized.length === prev.length &&
          normalized.every((entry, index) => {
            const current = prev[index];
            return (
              current &&
              current.code === entry.code &&
              current.type === entry.type &&
              (current.label ?? "") === (entry.label ?? "")
            );
          })
        ) {
          return prev;
        }
        return normalized;
      });
    },
    []
  );

  const setActionHotkeys = useCallback(
    (next: ActionHotkeys | ((prev: ActionHotkeys) => ActionHotkeys)) => {
      setActionHotkeysState((prev) => {
        const updated = typeof next === "function" ? (next as (prev: ActionHotkeys) => ActionHotkeys)(prev) : next;
        const normalized = normalizeActionHotkeys(updated);
        if (normalized.quickExportCode === prev.quickExportCode) {
          return prev;
        }
        return normalized;
      });
    },
    []
  );

  const setTheme = useCallback((next: ThemeName) => {
    setThemeState(next);
  }, [setThemeState]);
  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  }, [setThemeState]);
  const setCurveMode = useCallback((next: CurveMode) => {
    setCurveModeState(next);
  }, [setCurveModeState]);

  const setAssetLibraries = useCallback(
    (next: AssetLibrariesSettings | ((prev: AssetLibrariesSettings) => AssetLibrariesSettings)) => {
      setAssetLibrariesState((prev) => {
        const updated = typeof next === "function" ? (next as (prev: AssetLibrariesSettings) => AssetLibrariesSettings)(prev) : next;
        const normalized = normalizeAssetLibraries(updated);
        if (normalized.ambientcg.enabled === prev.ambientcg.enabled) {
          return prev;
        }
        return normalized;
      });
    },
    []
  );


  const renderSidebar = useCallback(
    ({ collapsed }: { collapsed: boolean }) => (
      <nav className="flex-1 p-2 space-y-1">
        <SidebarNavButton
          icon={<Layers className="h-4 w-4" />}
          label="Graph"
          collapsed={collapsed}
          active={activeView === "graph"}
          onClick={() => setActiveView("graph")}
        />
        <SidebarNavButton
          icon={<SettingsIcon className="h-4 w-4" />}
          label="Settings"
          collapsed={collapsed}
          active={activeView === "settings"}
          onClick={() => setActiveView("settings")}
        />
      </nav>
    ),
    [activeView, setActiveView]
  );

  useEffect(() => {
    if (activeView !== "settings") return;
    setMenu((m) => (m.open ? { ...m, open: false } : m));
    setMenuPaletteOverride(null);
  }, [activeView]);

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
    // Mark that this drag sequence actually produced a connection (including adapter insertions)
    if (connectDragRef.current) connectCompletedRef.current = true;
    const nodesNow = nodesRef.current;
    const nodeLabel = (nodeId: string | null | undefined): string => {
      if (!nodeId) return "Unknown";
      const node = nodesRef.current.find((n) => n.id === String(nodeId));
      return ((node?.data as any)?.label ?? (node?.data as any)?.type ?? String(nodeId)) as string;
    };
    const ok = isConnectionCompatible(nodesNow as any, params);
    if (!ok) {
      // Attempt adapter insertion for known cases (sampler2D->float/vecN, float->vecN, vec4->vec3, vec3->vec4)
      const srcType = getSourceType(nodesRef.current as any, params as any);
      const dstType = getTargetType(nodesRef.current as any, params as any);
      const paletteGet = (t: string) => paletteByType.get(t);

      const insertAndConnect = async (item: NodePaletteItem, position: { x: number; y: number }, template?: NodeTemplate, hookups?: (id: string) => void) => {
        const nextIdNum = idCounter.current + 1;
        const nextId = String(nextIdNum);
        const rfArgs: any = { id: nextId, item, position, nodeDefaults };
        if (template) rfArgs.template = template;
        const rfNode = buildRFNodeFromTemplate(rfArgs);
        const displayName = ((rfNode.data as any)?.label ?? (rfNode.data as any)?.type ?? item.name ?? item.type ?? `Node ${nextId}`) as string;
        beginHistoryActionRef.current({ type: "insert-adapter", summary: `${displayName} • Insert` });
        idCounter.current = nextIdNum;
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
    const srcLabel = nodeLabel(params.source as any);
    const dstLabel = nodeLabel(params.target as any);
    beginHistoryActionRef.current({ type: "connect", summary: `${srcLabel} → ${dstLabel}` });
    setEdges((eds) => {
      const next = connectSingleInputEdge(eds, params);
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

  const quickHotkeysForSettings = useMemo(() => {
    return quickNodeHotkeys.map((entry) => {
      const item = paletteByType.get(entry.type);
      const label = item?.name ?? entry.label ?? entry.type;
      if (entry.label === label) return entry;
      return { ...entry, label };
    });
  }, [paletteByType, quickNodeHotkeys]);

  const quickHotkeyMap = useMemo(() => buildQuickHotkeyMap(quickNodeHotkeys), [quickNodeHotkeys]);
  const quickExportReservedCodes = useMemo(
    () => (actionHotkeys.quickExportCode ? [actionHotkeys.quickExportCode] : []),
    [actionHotkeys.quickExportCode]
  );

  const enabledLibraryProviders = useMemo(() => {
    const list: string[] = [];
    if (assetLibraries.ambientcg.enabled) {
      list.push("ambientcg");
    }
    return list;
  }, [assetLibraries]);

  const handleQuickHotkeysChange = useCallback(
    (next: QuickNodeHotkey[]) => {
      setQuickNodeHotkeys(next);
    },
    [setQuickNodeHotkeys]
  );

  const settingsValue = useMemo(
    () => ({
      theme,
      setTheme,
      curveMode,
      setCurveMode,
      quickHotkeys: quickHotkeysForSettings,
      setQuickHotkeys: setQuickNodeHotkeys,
      actionHotkeys,
      setActionHotkeys,
      assetLibraries,
      setAssetLibraries,
    }),
    [
      actionHotkeys,
      assetLibraries,
      curveMode,
      quickHotkeysForSettings,
      setActionHotkeys,
      setAssetLibraries,
      setCurveMode,
      setQuickNodeHotkeys,
      setTheme,
      theme,
    ]
  );

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
    // Load available language templates for Export menu
    (async () => {
      try {
        const res = await apiFetch("/api/languages", { signal: ctrl.signal });
        const data = await res.json();
        const list: Array<{ key: string; name: string; path: string }> = Array.isArray(data.languages) ? data.languages : [];
        setLanguages(list);
      } catch (err) {
        if (isAbortError(err)) return;
        console.warn("Failed to fetch languages", err);
      }
    })();
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
        const raw = (p as any).type;
        if (Array.isArray(raw)) {
          for (const opt of raw) {
            const t = normalizePinType(opt);
            if (t && t !== "unknown") types.push(t);
          }
        } else {
          const t = normalizePinType(raw);
          if (t && t !== "unknown") types.push(t);
        }
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

  // Edge coloring is applied in the visibleEdges selector; avoid mutating edge state here

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

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (!clipboardStatus) return undefined;
    if (clipboardStatusTimerRef.current !== null) {
      window.clearTimeout(clipboardStatusTimerRef.current);
    }
    const timeout = window.setTimeout(() => {
      setClipboardStatus(null);
      clipboardStatusTimerRef.current = null;
    }, 2400);
    clipboardStatusTimerRef.current = timeout;
    return () => {
      if (clipboardStatusTimerRef.current !== null) {
        window.clearTimeout(clipboardStatusTimerRef.current);
        clipboardStatusTimerRef.current = null;
      }
    };
  }, [clipboardStatus]);

  const showClipboardStatus = useCallback((kind: "success" | "error", message: string) => {
    setClipboardStatus({ kind, message, key: Date.now() });
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

  const getHotkeyPointer = useCallback(() => lastPointerRef.current ?? getFlowCenterClient(), [getFlowCenterClient]);

  const [graphData, setGraphData] = useState<Graph>(() => buildGraphData(nodes as any, edges as any, graphName) as any);

  const resizingEditorIdsRef = useRef(new Set<string>());
  const pendingGraphUpdateRef = useRef(false);
  const draggingNodeIdsRef = useRef(new Set<string>());
  const autosaveTimeoutRef = useRef<number | null>(null);
  const resetInteractionState = useCallback(() => {
    resizingEditorIdsRef.current.clear();
    draggingNodeIdsRef.current.clear();
    pendingGraphUpdateRef.current = false;
  }, []);
  const pendingHistoryQueueRef = useRef<Array<{ meta: GraphActionMeta; before: GraphSnapshot }>>([]);

  const recomputeGraphData = useCallback(() => {
    const next = buildGraphData(nodesRef.current as any, edgesRef.current as any, graphNameRef.current);
    setGraphData(next as any);
  }, []);

  // Unit-of-Work scheduler: coalesce recomputes into a single RAF
  const graphRenderRafRef = useRef<number | null>(null);
  const scheduleGraphRender = useCallback(() => {
    // If we are in the middle of dragging/resizing, mark pending and defer until stop
    if (resizingEditorIdsRef.current.size > 0 || draggingNodeIdsRef.current.size > 0) {
      pendingGraphUpdateRef.current = true;
      return;
    }
    pendingGraphUpdateRef.current = false;
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      if (graphRenderRafRef.current) cancelAnimationFrame(graphRenderRafRef.current);
      graphRenderRafRef.current = window.requestAnimationFrame(() => {
        graphRenderRafRef.current = null;
        recomputeGraphData();
      });
    } else {
      // Fallback in non-browser/test environments
      if (graphRenderRafRef.current) {
        try { cancelAnimationFrame(graphRenderRafRef.current); } catch (_err) { void 0; }
        graphRenderRafRef.current = null;
      }
      setTimeout(() => recomputeGraphData(), 0);
    }
  }, [recomputeGraphData]);

  useEffect(() => {
    // Coalesce changes across nodes/edges/name into one frame
    scheduleGraphRender();
  }, [nodes, edges, graphName, scheduleGraphRender]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const pendingSizeUpdates: Array<{ id: string; width?: number; height?: number }> = [];
      const removedIds = new Set<string>();
      const movedIds = new Set<string>();

      const labelForId = (nodeId: string): string => {
        const node = nodesRef.current.find((n) => n.id === nodeId);
        return ((node?.data as any)?.label ?? (node?.data as any)?.type ?? nodeId) as string;
      };
      const formatList = (labels: string[]) => (labels.length === 1 ? labels[0] : `${labels.length} nodes`);

      for (const change of changes) {
        if (change.type === "remove") {
          resizingEditorIdsRef.current.delete(change.id);
          draggingNodeIdsRef.current.delete(change.id);
          removedIds.add(change.id);
          continue;
        }

        if (isDragStart(change)) {
          if (!dragSnapshotRef.current) {
            const snapshotter = captureSnapshotFnRef.current;
            if (snapshotter) dragSnapshotRef.current = snapshotter();
          }
          draggingNodeIdsRef.current.add(change.id);
          pendingGraphUpdateRef.current = true;
          continue;
        }

        if (isDragEnd(change)) {
          const dragEndChange = change as Extract<NodeChange, { type: "position" }>;
          const wasDragging = draggingNodeIdsRef.current.delete(dragEndChange.id);
          if (draggingNodeIdsRef.current.size === 0 && pendingGraphUpdateRef.current) {
            pendingGraphUpdateRef.current = false;
            scheduleGraphRender();
          }
          const nextPos = (dragEndChange as any)?.position ?? (dragEndChange as any)?.positionAbsolute ?? null;
          const currentNode = nodesRef.current.find((n) => n.id === dragEndChange.id);
          const prevPos = currentNode?.position ?? null;
          const moved = Boolean(wasDragging && nextPos && prevPos && (prevPos.x !== nextPos.x || prevPos.y !== nextPos.y));
          if (moved) movedIds.add(dragEndChange.id);
          continue;
        }

        if (change.type !== "dimensions") continue;
        const node = nodesRef.current.find((n) => n.id === change.id);
        const meta = (() => {
          if (!node) return [] as string[];
          const template = (node.data as any)?.template;
          return Array.isArray(template?.meta) ? (template.meta as string[]) : [];
        })();
        if (!meta.includes("editor_node")) continue;

        if (isResizeStart(change)) {
          if (!resizeSnapshotRef.current) {
            const snapshotter = captureSnapshotFnRef.current;
            if (snapshotter) resizeSnapshotRef.current = snapshotter();
          }
          resizingEditorIdsRef.current.add(change.id);
          pendingGraphUpdateRef.current = true;
          continue;
        }

        if (!isResizeEnd(change)) continue;
        const resizeEndChange = change as Extract<NodeChange, { type: "dimensions" }>;
        const wasResizing = resizingEditorIdsRef.current.delete(resizeEndChange.id);
        if (resizingEditorIdsRef.current.size === 0 && pendingGraphUpdateRef.current) {
          pendingGraphUpdateRef.current = false;
          scheduleGraphRender();
        }
        if (!wasResizing) continue;

        const currentSize = (() => {
          const parsed = parseEditorSize(meta as string[]);
          return { width: parsed.width, height: parsed.height };
        })();
        const readDimension = (key: "width" | "height"): number | undefined => {
          const dims = resizeEndChange.dimensions;
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
        const widthChanged = Number.isFinite(width) && (width as number) !== currentSize.width;
        const heightChanged = Number.isFinite(height) && (height as number) !== currentSize.height;
        if (!widthChanged && !heightChanged) continue;
        const next: { id: string; width?: number; height?: number } = { id: resizeEndChange.id };
        if (widthChanged) next.width = width as number;
        if (heightChanged) next.height = height as number;
        pendingSizeUpdates.push(next);
      }

      let resizeSummary: string | null = null;
      if (pendingSizeUpdates.length) {
        const updates = new Map<string, { width?: number; height?: number }>();
        pendingSizeUpdates.forEach((entry) => {
          const next: { width?: number; height?: number } = {};
          if (typeof entry.width === "number" && Number.isFinite(entry.width)) next.width = entry.width;
          if (typeof entry.height === "number" && Number.isFinite(entry.height)) next.height = entry.height;
          updates.set(entry.id, next);
        });
        const resizeLabels = Array.from(new Set(pendingSizeUpdates.map((entry) => labelForId(entry.id))));
        const resizeSummaryBase = formatList(resizeLabels);
        resizeSummary = `${resizeSummaryBase} • Resize`;
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

      const removedList = Array.from(removedIds);
      let moveSummary: string | null = null;
      if (removedList.length) {
        const labels = removedList.map(labelForId);
        beginHistoryActionRef.current({ type: "delete-node", summary: `${formatList(labels)} • Delete` });
      } else {
        const movedList = Array.from(movedIds).filter((id) => !removedIds.has(id));
        if (movedList.length) {
          const labels = movedList.map(labelForId);
          moveSummary = `${formatList(labels)} • Move`;
        }
      }

      if (resizeSummary && resizeSnapshotRef.current) {
        pendingHistoryQueueRef.current.push({ meta: { type: "resize-node", summary: resizeSummary }, before: resizeSnapshotRef.current });
        resizeSnapshotRef.current = null;
      } else if (!resizeSummary && resizeSnapshotRef.current && pendingSizeUpdates.length === 0) {
        resizeSnapshotRef.current = null;
      }
      if (moveSummary && dragSnapshotRef.current) {
        pendingHistoryQueueRef.current.push({ meta: { type: "move-node", summary: moveSummary }, before: dragSnapshotRef.current });
        dragSnapshotRef.current = null;
      } else if (!moveSummary && dragSnapshotRef.current && movedIds.size === 0) {
        dragSnapshotRef.current = null;
      }

      onNodesChange(changes);
    },
    [onNodesChange, scheduleGraphRender, setNodes]
  );

  // Visible graph based on current viewPath (root vs. inside a group)
  const currentParentId = viewPath.length ? viewPath[viewPath.length - 1] : undefined;
  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    const removed = changes.filter((change) => change.type === "remove");
    if (removed.length) {
      const connectionLabels = removed.map((change) => {
        const edge = edgesRef.current.find((e) => e.id === change.id);
        if (!edge) return change.id;
        const src = nodesRef.current.find((n) => n.id === edge.source);
        const dst = nodesRef.current.find((n) => n.id === edge.target);
        const srcLabel = (src?.data as any)?.label ?? (src?.data as any)?.type ?? edge.source;
        const dstLabel = (dst?.data as any)?.label ?? (dst?.data as any)?.type ?? edge.target;
        return `${srcLabel} → ${dstLabel}`;
      });
      const summaryBase = connectionLabels.length === 1 ? connectionLabels[0]! : `${connectionLabels.length} connections`;
      beginHistoryActionRef.current({ type: "disconnect", summary: summaryBase }, { skipIfPending: true });
    }
    onEdgesChange(changes);
  }, [onEdgesChange]);

  const visibleNodes = useMemo(() => {
    const base = prepareVisibleNodes(nodes as any, currentParentId) as any;
    if (!showCompileOnly) return base;
    return base.filter((n: any) => {
      const meta: any[] = Array.isArray((n.data as any)?.template?.meta) ? (n.data as any).template.meta : [];
      return !meta.includes("editor_node");
    });
  }, [nodes, currentParentId, showCompileOnly]);
  const visibleNodeIdSet = useMemo(() => new Set(visibleNodes.map((n: any) => n.id)), [visibleNodes]);
  const visibleNodeIds = useMemo(() => visibleNodes.map((n: any) => n.id), [visibleNodes]);
  const visibleEdges = useMemo(() => {
    const filtered = edges.filter((e) => visibleNodeIdSet.has(e.source) && visibleNodeIdSet.has(e.target));
    // Avoid expensive edge recoloring while dragging/resizing; edge component can infer on the fly
    if (resizingEditorIdsRef.current.size > 0 || draggingNodeIdsRef.current.size > 0) {
      return filtered;
    }
    return ensureColoredEdges(filtered, nodesRef.current);
  }, [edges, visibleNodeIdSet, ensureColoredEdges]);

  const fitViewToNodeIds = useCallback(
    (nodeIds: string[]) => {
      if (!nodeIds.length) return;
      try {
        rf.fitView({
          padding: 0.12,
          includeHiddenNodes: false,
          nodes: nodeIds.map((id) => ({ id })),
        } as any);
      } catch (_err) {
        // ignore viewport fit failures
      }
    },
    [rf]
  );

  useAutoFitOnViewPathChange({
    viewPath,
    visibleNodeIds,
    disabled: fitAfterLoadRef.current,
    fitView: fitViewToNodeIds,
  });

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

  const beginHistoryActionRef = useRef<GraphHistoryApi["beginAction"]>(() => ({ cancel: () => {}, updateMeta: () => {} }));
  const commitGraphMutationRef = useRef<CommitGraphMutation>(() => {});

  // Centralized updater to modify node template inputs while preserving parentId
  const updateInputValue = useCallback((id: string, pinId: number, next: number[] | string | number) => {
    const target = nodesRef.current.find((node) => node.id === id);
    const tpl = (target?.data as any)?.template;
    if (!target || !tpl || !Array.isArray(tpl.inputs)) return;
    const idx = tpl.inputs.findIndex((p: any, i: number) => (typeof p.id === "number" ? p.id === pinId : i === pinId));
    if (idx < 0) return;
    const pin = tpl.inputs[idx];
    const nodeLabel = ((target.data as any)?.label ?? (target.data as any)?.type ?? id) as string;
    const pinName = pin && typeof pin.name === "string" && pin.name.length ? pin.name : `Input ${pinId}`;
    commitGraphMutationRef.current({ type: "update-input", summary: `${nodeLabel} • ${pinName}` }, () => {
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== id) return n;
          const tplNow = (n.data as any)?.template;
          if (!tplNow || !Array.isArray(tplNow.inputs)) return n;
          const idxNow = tplNow.inputs.findIndex((p: any, i: number) => (typeof p.id === "number" ? p.id === pinId : i === pinId));
          if (idxNow < 0) return n;
          const normalized = Array.isArray(next) ? next : typeof next === "number" ? [next] : next;
          const nextTpl = { ...tplNow, inputs: tplNow.inputs.map((p: any, i: number) => (i === idxNow ? { ...p, value: normalized } : p)) };
          return { ...n, data: { ...(n.data as any), template: nextTpl } } as any;
        })
      );
    });
  }, [setNodes]);

  const updateNodePropertyValue = useCallback((id: string, propId: string, next: unknown) => {
    if (!propId) return;
    const target = nodesRef.current.find((node) => node.id === id);
    const tpl = (target?.data as any)?.template ?? {};
    const propsList: any[] = Array.isArray((tpl as any)?.properties) ? ([...(tpl as any).properties] as any[]) : [];
    if (!target || propsList.length === 0) return;
    const prop = propsList.find((entry) => entry && typeof entry === "object" && entry.id === propId);
    if (!prop) return;
    const isAssetProp = typeof (prop as any)?.type === "string" && (prop as any).type === "asset";
    let normalizedNext: unknown = next;
    if (isAssetProp && typeof next === "string") {
      const trimmed = next.trim();
      normalizedNext = trimmed.length > 0 ? trimmed : "";
    }
    const nodeLabel = ((target.data as any)?.label ?? (target.data as any)?.type ?? id) as string;
    const propLabel = typeof prop.label === "string" && prop.label.length ? prop.label : propId;
    commitGraphMutationRef.current({ type: "update-property", summary: `${nodeLabel} • ${propLabel}` }, () => {
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== id) return n;
          const tplNow = (n.data as any)?.template ?? {};
          const propsNow: any[] = Array.isArray((tplNow as any).properties) ? ([...(tplNow as any).properties] as any[]) : [];
          const nextProps = propsNow.map((propEntry) => {
            if (!propEntry || typeof propEntry !== "object" || propEntry.id !== propId) return propEntry;
            if (normalizedNext === undefined) {
              const updated = { ...propEntry } as any;
              delete updated.value;
              return updated;
            }
            return { ...propEntry, value: normalizedNext };
          });
          const nextData: any = { ...(n.data as any), template: { ...tplNow, properties: nextProps } };
          if (isAssetProp) {
            const prevAsset = (n.data as any)?.asset;
            if (typeof normalizedNext === "string" && normalizedNext.length > 0) {
              if (prevAsset && prevAsset.source === normalizedNext) {
                nextData.asset = { ...prevAsset };
              } else if (prevAsset) {
                delete nextData.asset;
              }
            } else if (prevAsset) {
              delete nextData.asset;
            }
          }
          return { ...n, data: nextData } as any;
        })
      );
    });
  }, [setNodes]);

  const updateNodeAsset = useCallback((id: string, asset: NodeAssetPayload | null) => {
    const target = nodesRef.current.find((node) => node.id === id);
    if (!target) return;
    const nodeLabel = ((target.data as any)?.label ?? (target.data as any)?.type ?? id) as string;
    const assetLabel = asset ? asset.label ?? asset.id ?? asset.source ?? "Assign Asset" : "Remove Asset";
    beginHistoryActionRef.current({ type: "update-asset", summary: `${nodeLabel} • ${assetLabel}` });
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
    const target = nodesRef.current.find((node) => node.id === id);
    if (!target) return;
    const currentLabel = ((target.data as any)?.label ?? (target.data as any)?.type ?? id) as string;
    beginHistoryActionRef.current({ type: "rename-node", summary: `${currentLabel} → ${label}` });
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
    const target = nodesRef.current.find((node) => node.id === id);
    if (!target) return;
    const nodeLabel = ((target.data as any)?.label ?? (target.data as any)?.type ?? id) as string;
    beginHistoryActionRef.current({ type: "add-meta", summary: `${nodeLabel} • ${metaKey}` });
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
    const target = nodesRef.current.find((node) => node.id === id);
    if (!target) return;
    const nodeLabel = ((target.data as any)?.label ?? (target.data as any)?.type ?? id) as string;
    beginHistoryActionRef.current({ type: "remove-meta", summary: `${nodeLabel} • ${metaKey}` });
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
      updateInputValue,
      updatePropertyValue: updateNodePropertyValue,
      updateNodeLabel,
      addNodeMeta,
      removeNodeMeta,
      updateNodeAsset,
    }),
    [updateInputValue, updateNodePropertyValue, updateNodeLabel, addNodeMeta, removeNodeMeta, updateNodeAsset]
  );

  const {
    beginAction: beginHistoryAction,
    undo: undoHistory,
    redo: redoHistory,
    canUndo,
    canRedo,
    peekUndo,
    peekRedo,
    reset: resetHistory,
    captureSnapshot: captureHistorySnapshot,
    pushEntryWithSnapshots: pushHistorySnapshots,
  } = useGraphHistory({
    nodes,
    edges,
    viewPath,
    graphName,
    nodesRef,
    edgesRef,
    viewPathRef,
    graphNameRef,
    idCounterRef: idCounter,
    nodeUpdaterApi,
    setNodes,
    setEdges,
    setViewPath,
    setGraphName,
    resetInteractionState,
  });

  const commitGraphMutation = useCallback((meta: GraphActionMeta, mutator: () => void) => {
    const before = captureHistorySnapshot();
    mutator();
    pendingHistoryQueueRef.current.push({ meta, before });
  }, [captureHistorySnapshot]);
  commitGraphMutationRef.current = commitGraphMutation;
  beginHistoryActionRef.current = beginHistoryAction;
  captureSnapshotFnRef.current = captureHistorySnapshot;

  useEffect(() => {
    if (!pendingHistoryQueueRef.current.length) return;
    const queued = pendingHistoryQueueRef.current.splice(0);
    for (const entry of queued) {
      pushHistorySnapshots(entry.meta, entry.before);
    }
  }, [nodes, edges, pushHistorySnapshots]);


  const formatHistoryPreview = useCallback((meta: GraphActionMeta | null) => {
    if (!meta) return "No Action";
    const summary = typeof meta.summary === "string" ? meta.summary.trim() : "";
    return summary ? `${meta.type} • ${summary}` : meta.type;
  }, []);

  const nodesById = useMemo(() => {
    const map = new Map<string, Node>();
    for (const node of nodes) map.set(node.id, node);
    return map;
  }, [nodes]);

  const selectedCount = useMemo(() => nodes.filter((node) => node.selected).length, [nodes]);

  const graphStateValue = useMemo(
    () => ({
      nodesById,
      nodeUpdaterApi,
      graph: graphData as any,
      undo: undoHistory,
      redo: redoHistory,
      canUndo,
      canRedo,
      peekUndo,
      peekRedo,
    }),
    [nodesById, nodeUpdaterApi, graphData, undoHistory, redoHistory, canUndo, canRedo, peekUndo, peekRedo]
  );

  const handleEdgeDoubleClick = useCallback((event: MouseEvent, edge: Edge) => {
    event.preventDefault();
    event.stopPropagation();
    if (!edge) return;
    const item = paletteByType.get("reroute");
    if (!item) return;
    const cache = templateCacheRef.current;
    if (!cache) return;

    const client = { x: event.clientX, y: event.clientY };
    let position;
    try {
      position = rf.screenToFlowPosition(client);
    } catch (_err) {
      position = { x: client.x, y: client.y };
    }

    const run = async () => {
      let template: NodeTemplate | undefined;
      try {
        template = await cache.load(item.type, item.path);
      } catch (err) {
        console.warn("Failed to load reroute node template", err);
        return;
      }
      if (!template) return;
      cache.prime(item.type, template);

      const edgesNow = edgesRef.current as Edge[];
      const nodesNow = nodesRef.current as Node[];
      if (!edgesNow.some((e) => e.id === edge.id)) return;
      const nextIdNum = idCounter.current + 1;
      const nextId = String(nextIdNum);

      try {
        const insertion = createRerouteInsertion({
          edge,
          edges: edgesNow,
          nodes: nodesNow,
          template,
          item,
          position,
          nextId,
          nodeDefaults,
        });

        const decoratedNode = attachNodeUpdateApi(insertion.node as any, nodeUpdaterApi);
        beginHistoryActionRef.current({ type: "add-node", summary: `${item.name ?? item.type} • Add` });
        idCounter.current = nextIdNum;
        pendingGraphUpdateRef.current = true;
        setNodes((prev) => [...prev, decoratedNode as any]);
        const nodesForColor = [...nodesNow, decoratedNode as any];
        setEdges(() => ensureColoredEdges(insertion.edges, nodesForColor as any));
      } catch (err) {
        console.warn("Failed to insert reroute node", err);
      }
    };

    void run();
  }, [ensureColoredEdges, nodeUpdaterApi, paletteByType, rf, setEdges, setNodes]);

  // Stabilize ReactFlow config to reduce unnecessary re-renders
  const nodeTypes = useMemo(() => ({ graphNode: GraphNode }), []);
  const edgeTypes = useMemo(() => ({ colored: ColoredEdge as any }), []);
  const isValidConnectionCb = useCallback((conn: any) => isConnectionCompatible(nodesRef.current as any, conn as any), []);

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
        const labels = existing.map((node) => ((node.data as any)?.label ?? (node.data as any)?.type ?? node.id) as string);
        const summaryBase = labels.length === 1 ? labels[0] : `${labels.length} nodes`;
        beginHistoryActionRef.current({ type: "delete-node", summary: `${summaryBase} • Remove` });
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

      const nextIdNum = idCounter.current + 1;
      const nextId = String(nextIdNum);
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
      const displayName = ((decoratedNode.data as any)?.label ?? (decoratedNode.data as any)?.type ?? item.name ?? type) as string;
      beginHistoryActionRef.current({ type: "add-node", summary: `${displayName} • Add` });
      idCounter.current = nextIdNum;
      setNodes((prev) => [...prev, decoratedNode as any]);
    },
    [currentParentId, paletteByType, setNodes, setEdges, nodeUpdaterApi, rf, getFlowCenterClient]
  );

  const inflateAndLoadGraph = useCallback(
    async (graph: CanonicalNode, label: string) => {
      // Ensure we can resolve templates even if the palette hasn't finished loading yet (prod race on fast loads)
      // Build a fallback loader that fetches a local palette snapshot if needed.
      const loadTemplateForInflate = async (type: string) => {
        try {
          const fromState = paletteByType.get(type);
          if (fromState) {
            return await fetchNodeTemplate(fromState.path);
          }
          // Fallback: fetch a fresh palette snapshot and look up the path
          const fresh = await fetchNodePalette().catch((err) => {
            console.error("[inflate] Failed to load node palette on demand", err);
            return null as any;
          });
          if (fresh && Array.isArray(fresh.flat)) {
            const found = fresh.flat.find((it: any) => it && it.type === type);
            if (found && found.path) {
              try {
                return await fetchNodeTemplate(found.path);
              } catch (err) {
                console.error("[inflate] Failed to fetch node template", type, err);
                return undefined;
              }
            }
          }
          console.error("[inflate] Missing node template for type", type);
          return undefined;
        } catch (err) {
          console.error("[inflate] Unexpected error resolving template", type, err);
          return undefined;
        }
      };

      const { graph: inflatedGraph, defaults } = await inflateGraph(graph, loadTemplateForInflate);
      const rootCandidate: any = inflatedGraph as any;
      const rootGraph: CanonicalNode = (!rootCandidate?.type || rootCandidate.type === "") && Array.isArray(rootCandidate?.nodes)
        ? (rootCandidate.nodes.find((n: any) => n?.type === "surface") ?? rootCandidate.nodes[0])
        : (inflatedGraph as any);

      const assetRegistry = await loadAssetRegistry({ providers: enabledLibraryProviders });

      const buildResult = buildReactFlowGraph({
        root: rootGraph as any,
        defaults,
        assets: assetRegistry,
        options: { nodeDefaults },
      });

      idCounter.current = buildResult.maxId;
      resizingEditorIdsRef.current.clear();
      dragSnapshotRef.current = null;
      resizeSnapshotRef.current = null;
      pendingHistoryQueueRef.current.splice(0);
      pendingGraphUpdateRef.current = false;

      setNodes(attachNodesUpdateApi(buildResult.nodes as any, nodeUpdaterApi) as any);
      setEdges(buildResult.edges);
      setGraphName(label ?? "UntitledGraph");
      setViewPath(buildResult.defaultViewPath);
      resetHistory();
      // Request a one-time fitView after nodes render for this load
      fitAfterLoadRef.current = true;
    },
    // ensureColoredEdges is not referenced inside; remove to satisfy exhaustive-deps
    [enabledLibraryProviders, nodeUpdaterApi, resetHistory, setEdges, setGraphName, setNodes, setViewPath, paletteByType]
  );

  const loadExampleGraph = useCallback(async (ex: { key: string; label: string }) => {
    try {
      const params = new URLSearchParams({ name: ex.key });
      const res = await apiFetch(`/api/example-graphs?${params.toString()}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const graph = data?.graph as CanonicalNode | undefined;
      if (!graph || typeof graph !== "object") throw new Error("Invalid example graph payload");
      await inflateAndLoadGraph(graph, ex.label ?? "UntitledGraph");
    } catch (err) {
      console.warn("Failed to load example graph", ex, err);
    }
  }, [inflateAndLoadGraph]);

  const handleLoadExampleGraph = useCallback((key: string) => {
    const example = examples.find(e => e.key === key);
    if (example) {
      void loadExampleGraph(example);
    } else {
      console.warn("Example graph not found for key:", key);
    }
  }, [examples, loadExampleGraph]);

  // Fetch example graphs and load the first by default (only if no recent graph was loaded)
  useEffect(() => {
    if (IS_TEST_ENV) return;
    const abort = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/example-graphs", { signal: abort.signal });
        const data = await res.json();
        const list: Array<{ key: string; label: string }> = Array.isArray(data.examples) ? data.examples : [];
        if (cancelled) return;
        setExamples(list);
        if (startupAttemptedRef.current && !initialLoadDoneRef.current && list.length) {
          await loadExampleGraph(list[0]!);
          if (cancelled) return;
          initialLoadDoneRef.current = true;
        }
      } catch (err: any) {
        if (isAbortError(err)) return;
        console.warn("Failed to load example graphs", err);
      }
    })();
    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [loadExampleGraph, recentGraphs, recentGraphsInitialized]);

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
        const baseLabel = (() => {
          const stripped = suggested.replace(/\.[^.]+$/, "").trim();
          return stripped.length ? stripped : (graphName.trim().length ? graphName : "UntitledGraph");
        })();
        const defaultName = baseLabel.replace(/\s+/g, "_");
        const promptValue = typeof window !== "undefined" ? window.prompt("Save graph as", defaultName) : defaultName;
        if (promptValue === null) {
          return;
        }
        const normalizedInput = (promptValue ?? defaultName).trim();
        const sanitizedBase = (normalizedInput.length ? normalizedInput : defaultName).replace(/[\\/:*?"<>|]+/g, "_");
        const filename = sanitizedBase.toLowerCase().endsWith(".osg") ? sanitizedBase : `${sanitizedBase}.osg`;
        const label = filename.replace(/\.[^.]+$/, "");
        const contents = serializeGraph(label);
        triggerDownload(filename, contents);
        fileHandleRef.current = null;
        setFileName(filename);
        setGraphName(label);
        rememberRecentGraph(filename, contents, null);
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

  const compileToLanguage = useCallback(
    async (languageKey: string): Promise<{ code: string; ext: string; label: string }> => {
      const label = getGraphLabelKey();
      const deepGraph = JSON.parse(JSON.stringify(graphData));
      const res = await fetch(resolveApiUrl("/api/compile"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graph: deepGraph, language: languageKey, engine: "default" }),
      });
      if (!res.ok) throw new Error(`Compile failed: ${res.status}`);
      const data = await res.json();
      const code: string = String(data.code ?? "");
      let ext = "txt";
      try {
        const params = new URLSearchParams({ name: languageKey });
        const lr = await apiFetch(`/api/language?${params.toString()}`);
        if (lr.ok) {
          const langPack = await lr.json();
          const exts = Array.isArray(langPack?.file_extensions) ? langPack.file_extensions : [];
          if (exts.length && typeof exts[0] === "string") ext = exts[0];
        }
      } catch (_err) {
        // keep default extension
      }
      return { code, ext, label };
    },
    [graphData, getGraphLabelKey]
  );

  const handleExportLanguage = useCallback(
    async (languageKey: string) => {
      const graphKey = getGraphLabelKey();
      try {
        const { code, ext, label } = await compileToLanguage(languageKey);
        const safeLabel = label.replace(/\s+/g, "_") || "UntitledGraph";
        const picker = fileSystemAccessSupported ? (window as any).showSaveFilePicker : undefined;
        if (typeof picker === "function") {
          const handle = await picker({
            suggestedName: `${safeLabel}.${ext}`,
            types: [
              {
                description: `${languageKey} shader`,
                accept: { "text/plain": [`.${ext}`] },
              },
            ],
          });
          if (!handle) return;
          await writeFileHandle(handle, code);
          setQuickExportState(handle, languageKey);
          await Promise.all([
            saveExportHandle(graphKey, languageKey, handle),
            setLastExportLanguage(graphKey, languageKey),
          ]);
          return;
        }
        triggerTextDownload(`${safeLabel}.${ext}`, code, "text/plain");
        try {
          await setLastExportLanguage(graphKey, languageKey);
        } catch (_err) {
          // ignore persistence failures when falling back to downloads
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.warn("Export failed", err);
      }
    },
    [
      compileToLanguage,
      fileSystemAccessSupported,
      getGraphLabelKey,
      setQuickExportState,
      writeFileHandle,
    ]
  );

  const handleQuickExport = useCallback(async () => {
    if (!fileSystemAccessSupported) return;
    const language = quickExportLanguageRef.current;
    const handle = quickExportHandleRef.current;
    if (!language || !handle) return;
    const graphKey = getGraphLabelKey();
    try {
      const permitted = await ensureReadWritePermission(handle);
      if (!permitted) {
        setQuickExportState(null, null);
        try {
          await Promise.all([
            removeExportHandle(graphKey, language),
            setLastExportLanguage(graphKey, ""),
          ]);
        } catch (_err) {
          // ignore cleanup failures
        }
        return;
      }
      const { code } = await compileToLanguage(language);
      await writeFileHandle(handle, code);
      try {
        await setLastExportLanguage(graphKey, language);
      } catch (_err) {
        // ignore persistence failures
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.warn("Quick export failed", err);
    }
  }, [
    compileToLanguage,
    ensureReadWritePermission,
    fileSystemAccessSupported,
    getGraphLabelKey,
    setQuickExportState,
    writeFileHandle,
  ]);

  useEffect(() => {
    if (!fileSystemAccessSupported) {
      setQuickExportState(null, null);
      return;
    }
    let cancelled = false;
    const graphKey = getGraphLabelKey();
    (async () => {
      try {
        const lastLanguage = await getLastExportLanguage(graphKey);
        if (cancelled) return;
        if (!lastLanguage) {
          setQuickExportState(null, null);
          return;
        }
        const handle = await loadExportHandle(graphKey, lastLanguage);
        if (cancelled) return;
        if (!handle) {
          setQuickExportState(null, null);
          try {
            await setLastExportLanguage(graphKey, "");
          } catch (_err) {
            // ignore
          }
          return;
        }
        const permitted = await ensureReadWritePermission(handle);
        if (cancelled) return;
        if (!permitted) {
          setQuickExportState(null, null);
          try {
            await Promise.all([
              removeExportHandle(graphKey, lastLanguage),
              setLastExportLanguage(graphKey, ""),
            ]);
          } catch (_err) {
            // ignore cleanup failures
          }
          return;
        }
        setQuickExportState(handle, lastLanguage);
      } catch (err) {
        if (!cancelled) {
          console.warn("Failed to rehydrate export handle", err);
          setQuickExportState(null, null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ensureReadWritePermission, fileSystemAccessSupported, getGraphLabelKey, setQuickExportState]);

  const handleClearRecent = useCallback(() => {
    for (const entry of recentGraphs) {
      void removeRecentGraphHandle(entry.name);
    }
    setRecentGraphs(clearRecentGraphs());
  }, [recentGraphs, setRecentGraphs]);

  // Lightweight autosave of current session (supports restoring unsaved graphs)
  // Debounced and paused during drag/resize to avoid heavy work on every frame
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") return;
    if (!startupAttemptedRef.current || !initialLoadDoneRef.current) return;
    if (!nodesRef.current.length) return;
    // Skip scheduling while dragging/resizing; we'll save when motion stops
    if (resizingEditorIdsRef.current.size > 0 || draggingNodeIdsRef.current.size > 0) return;
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }
    const run = () => {
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
    };
    autosaveTimeoutRef.current = window.setTimeout(run, 800);
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
        autosaveTimeoutRef.current = null;
      }
    };
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

        const passLayout = computeDefaultPassLayout();
        vertexPass.position = passLayout.vertexPass;
        fragmentPass.position = passLayout.fragmentPass;
        vertexOutput.position = passLayout.vertexOutput;
        fragmentOutput.position = passLayout.fragmentOutput;
        if (previewNode) previewNode.position = passLayout.preview;

        vertexPass.nodes = [vertexOutput];
        fragmentPass.nodes = [fragmentOutput];

        if (previewNode) {
          // Ensure meta array exists (editor node sizing comes from template meta)
          if (!Array.isArray(previewNode.meta)) previewNode.meta = [];
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
        setEdges(buildResult.edges);
        setGraphName(`Untitled ${shading.charAt(0).toUpperCase()}${shading.slice(1)}`);
        setViewPath(buildResult.defaultViewPath);
        resetHistory();
        // Request a one-time fitView after nodes render for this new graph
        fitAfterLoadRef.current = true;
      } catch (err) {
        console.warn("Failed to create new graph", shading, err);
      }
    },
    // ensureColoredEdges is not referenced inside; remove to satisfy exhaustive-deps
    [paletteByType, loadTemplateDefaults, resetHistory, setNodes, setEdges, setGraphName, setViewPath, nodeUpdaterApi]
  );

  const addNodeAt = useCallback(async (opts: { item: NodePaletteItem; x: number; y: number }) => {
    const { item, x, y } = opts;
    const nextIdNum = idCounter.current + 1;
    const nextId = String(nextIdNum);
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
    const label = ((rfNode.data as any)?.label ?? (rfNode.data as any)?.type ?? item.name ?? item.type ?? `Node ${nextId}`) as string;
    beginHistoryActionRef.current({ type: "add-node", summary: `${label} • Add` });
    idCounter.current = nextIdNum;
    // Inject updater on the new node
    const decoratedNode = attachNodeUpdateApi(rfNode as any, nodeUpdaterApi);
    setNodes((prev) => [...prev, decoratedNode as any]);

    // If this node was added from a drag gesture, auto-connect first compatible opposite pin
    try {
      const drag = pendingConnectRef.current;
      pendingConnectRef.current = null;
      const tpl: any = (rfNode as any)?.data?.template;
      if (!drag || !tpl) return;
      const draggedTypes = (() => {
        const opts = getPinTypeOptionsFor(nodesRef.current as any, drag.nodeId, drag.handleId) as ReturnType<typeof normalizePinType>[];
        return (Array.isArray(opts) && opts.length ? opts : [drag.type]).filter((t) => t && t !== "unknown");
      })();
      const findFirstMatchingPinIndex = (
        pins: any[] | undefined,
        isFromSource: boolean,
        dragged: ReturnType<typeof normalizePinType>[]
      ): number => {
        const list = Array.isArray(pins) ? pins : [];
        for (let i = 0; i < list.length; i++) {
          const p = list[i];
          if (!p || typeof p !== "object") continue;
          const raw = (p as any).type;
          const opts: ReturnType<typeof normalizePinType>[] = Array.isArray(raw)
            ? raw.map((r: any) => normalizePinType(r)).filter((t) => t && t !== "unknown")
            : [normalizePinType(raw)].filter((t) => t && t !== "unknown");
          if (isFromSource) {
            if (opts.some((t) => dragged.some((dt) => arePinTypesCompatible(dt, t)))) return i;
          } else {
            if (opts.some((t) => dragged.some((dt) => arePinTypesCompatible(t, dt)))) return i;
          }
        }
        return -1;
      };
      const isFromSource = drag.side === "source";
      const idx = isFromSource
        ? findFirstMatchingPinIndex(tpl?.inputs as any, true, draggedTypes)
        : findFirstMatchingPinIndex(tpl?.outputs as any, false, draggedTypes);
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
        ? { sourceType: (draggedTypes[0] ?? drag.type), targetType: newPinType }
        : { sourceType: newPinType, targetType: (draggedTypes[0] ?? drag.type) };
      const conn: Connection = isFromSource
        ? ({ source: drag.nodeId, sourceHandle: drag.handleId, target: nextId, targetHandle: newHandle, data: connData } as any)
        : ({ source: nextId, sourceHandle: newHandle, target: drag.nodeId, targetHandle: drag.handleId, data: connData } as any);
      setEdges((eds) => connectSingleInputEdge(eds, conn));
    } catch (_err) {
      // ignore auto-connect failures
    }
  }, [currentParentId, nodeUpdaterApi, rf, setEdges, setNodes]);

  useGraphHotkeys({
    getPointerClient: getHotkeyPointer,
    toggleEditorNode,
    addNodeAt,
    paletteByType,
    quickHotkeys: quickHotkeyMap,
    reservedCodes: quickExportReservedCodes,
  });

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (isEditableHotkeyTarget(event.target)) return;
      const isMod = event.metaKey || event.ctrlKey;
      if (!isMod || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undoHistory();
        return;
      }
      if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        redoHistory();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [redoHistory, undoHistory]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (isEditableHotkeyTarget(event.target)) return;
      const isMod = event.metaKey || event.ctrlKey;
      if (!isMod || !event.shiftKey || event.altKey) return;
      if (event.code !== actionHotkeys.quickExportCode) return;
      event.preventDefault();
      void handleQuickExport();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [actionHotkeys.quickExportCode, handleQuickExport]);

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
    // Expand dragged handle into all allowed type options
    const draggedOptions = getPinTypeOptionsFor(nodesRef.current as any, drag.nodeId, drag.handleId) as ReturnType<typeof normalizePinType>[];
    const draggedTypes: ReturnType<typeof normalizePinType>[] = (Array.isArray(draggedOptions) && draggedOptions.length ? draggedOptions : [drag.type]).filter((t) => t && t !== "unknown");
    const fromSource = drag.side === "source";
    const items = palette.flat;
    const results: NodePaletteItem[] = [];
    await Promise.all(
      items.map(async (it) => {
        const idx = await loadPinIndex(it);
        if (fromSource) {
          if (idx.inputs.some((t) => draggedTypes.some((dt) => arePinTypesCompatible(dt, t)))) results.push(it);
        } else {
          if (idx.outputs.some((t) => draggedTypes.some((dt) => arePinTypesCompatible(t, dt)))) results.push(it);
        }
      })
    );
    const filtered = buildFilteredPalette(results);
    openAddNodeMenuAt(client.x, client.y, filtered);
  }, [palette, loadPinIndex, buildFilteredPalette, openAddNodeMenuAt]);

  const deleteNodeById = useCallback(
    async (id: string) => {
      const node = nodesById.get(id);
      if (!node) return;
      if ((node as any).deletable === false) return; // protect mandatory IO nodes
      const nodeLabel = ((node.data as any)?.label ?? (node.data as any)?.type ?? id) as string;
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

      beginHistoryActionRef.current({ type: "delete-node", summary: `${nodeLabel} • Delete` });
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

  const duplicateSelection = useCallback(
    (options?: { targetId?: string }) => {
      const currentNodes = nodesRef.current;
      const currentEdges = edgesRef.current;
      let selectedNodes = currentNodes.filter((node) => node.selected);
      if (options?.targetId && !selectedNodes.some((n) => n.id === options.targetId)) {
        const targetNode = currentNodes.find((n) => n.id === options.targetId);
        if (targetNode) selectedNodes = [...selectedNodes, targetNode];
      }
      if (!selectedNodes.length) return;

      const selectedIds = new Set(selectedNodes.map((n) => n.id));
      const duplicate = duplicateNodes({
        nodes: currentNodes,
        edges: currentEdges,
        selectedIds,
        allocateId: () => ++idCounter.current,
        offset: DUPLICATE_OFFSET,
      });
      if (!duplicate.nodesToAdd.length) return;

      const label = selectedNodes.length === 1
        ? (((selectedNodes[0]?.data as any)?.label ?? (selectedNodes[0]?.data as any)?.type ?? selectedNodes[0]?.id) as string)
        : `${selectedNodes.length} nodes`;

      const merged = applyDuplicateSelection({
        nodes: currentNodes,
        edges: currentEdges,
        selectedIds,
        duplicate,
      });

      beginHistoryActionRef.current({ type: "duplicate-node", summary: `${label} • Duplicate` });
      pendingGraphUpdateRef.current = true;

      const decoratedNodes = attachNodesUpdateApi(merged.nodes as any, nodeUpdaterApi) as any;
      setNodes(decoratedNodes);
      const coloredEdges = ensureColoredEdges(merged.edges as any, decoratedNodes as any);
      setEdges(coloredEdges);
    },
    [ensureColoredEdges, nodeUpdaterApi, setEdges, setNodes]
  );

  type ClipboardBounds = ClipboardPayload["bounds"];

  const computeSelectionBounds = useCallback((nodesList: Node[]): ClipboardBounds => {
    if (!nodesList.length) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const node of nodesList) {
      const pos = node.position ?? { x: 0, y: 0 };
      const x = Number.isFinite(pos.x) ? pos.x : 0;
      const y = Number.isFinite(pos.y) ? pos.y : 0;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    return { minX, minY, maxX, maxY };
  }, []);

  const serializeClipboardSnapshot = useCallback((options?: { includeId?: string }) => {
    const includeId = options?.includeId;
    const selectionMap = new Map<string, Node>();
    for (const node of nodesRef.current) {
      if (node.selected) selectionMap.set(node.id, node);
    }
    if (includeId && !selectionMap.has(includeId)) {
      const target = nodesRef.current.find((node) => node.id === includeId);
      if (target) selectionMap.set(target.id, target);
    }
    const selected = Array.from(selectionMap.values());
    if (!selected.length) return null;
    const selectedIds = new Set<number>();
    for (const node of selected) {
      const idNum = Number(node.id);
      if (Number.isFinite(idNum)) selectedIds.add(idNum);
    }
    if (!selectedIds.size) return null;
    const bounds = computeSelectionBounds(selected);
    const payload = createClipboardPayload({
      graph: graphData,
      selectedIds,
      parentLookup: (id) => {
        const found = nodesRef.current.find((node) => Number(node.id) === id);
        if (!found) return null;
        const raw = (found as any)?.parentId;
        if (raw === undefined || raw === null) return null;
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
      },
      bounds,
    });
    if (!payload) return null;
    return { text: JSON.stringify(payload), count: selected.length };
  }, [computeSelectionBounds, graphData]);

  const writeClipboardText = useCallback(async (text: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_err) {
      // fall through to fallback
    }
    if (typeof document === "undefined") return false;
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      return true;
    } catch (_err) {
      return false;
    }
  }, []);

  const copySelectionManual = useCallback(async (targetId?: string) => {
    const snapshot = serializeClipboardSnapshot(targetId ? { includeId: targetId } : undefined);
    if (!snapshot) {
      showClipboardStatus("error", "Select node(s) to copy");
      return;
    }
    const ok = await writeClipboardText(snapshot.text);
    if (ok) {
      showClipboardStatus("success", `Copied ${snapshot.count} node${snapshot.count === 1 ? "" : "s"}`);
    } else {
      showClipboardStatus("error", "Unable to access clipboard");
    }
  }, [serializeClipboardSnapshot, showClipboardStatus, writeClipboardText]);

  const performPasteFromText = useCallback(async (text: string) => {
    let payload: ClipboardPayload;
    try {
      payload = parseClipboardPayload(text);
    } catch (err) {
      console.warn("Invalid clipboard payload", err);
      showClipboardStatus("error", "Clipboard data is not valid");
      return;
    }
    const allocateId = () => ++idCounter.current;
    const remapped = remapClipboardNodes({ payload, allocateId, offset: PASTE_OFFSET });
    if (!remapped.nodes.length) {
      showClipboardStatus("error", "Clipboard payload is empty");
      return;
    }
    try {
      const newNodes: Node[] = [];
      const edgeRegex = /^\.\.\/(\d+)\/(\d+)$/;
      const idMapStrings = new Map<string, string>();
      remapped.idMap.forEach((newId, oldId) => {
        idMapStrings.set(String(oldId), String(newId));
      });
      for (const graphNode of remapped.nodes) {
        const defaults = await loadTemplateDefaults(graphNode.type);
        const paletteItem = paletteByType.get(graphNode.type) ?? ({
          type: graphNode.type,
          name: graphNode.name ?? graphNode.type,
          path: graphNode.type,
          category: "Clipboard",
        } as NodePaletteItem);
        const positionArray = Array.isArray(graphNode.position) && graphNode.position.length >= 2 ? graphNode.position : [0, 0];
        const rfNode = buildRFNodeFromTemplate({
          id: String(graphNode.id),
          item: paletteItem,
          template: graphNode,
          templateDefaults: defaults ?? undefined,
          position: { x: Math.round(positionArray[0]), y: Math.round(positionArray[1]) },
          parentId: undefined,
          nodeDefaults,
        });
        rfNode.selected = true;
        const assignment = remapped.parentAssignments.get(graphNode.id) ?? null;
        if (assignment !== null) {
          (rfNode as any).parentId = String(assignment);
        } else {
          delete (rfNode as any).parentId;
        }
        newNodes.push(rfNode as any);
      }

      const edgesToAdd: Edge[] = [];
      let edgeSeq = 0;
      for (const graphNode of remapped.nodes) {
        const inputs = Array.isArray(graphNode.inputs) ? graphNode.inputs : [];
        for (let i = 0; i < inputs.length; i += 1) {
          const pin = inputs[i];
          const value = (pin as any)?.value;
          if (typeof value !== "string") continue;
          const match = value.match(edgeRegex);
          if (!match) continue;
          const sourceId = match[1];
          const pinId = Number(match[2]);
          const targetPinId = typeof pin.id === "number" ? pin.id : i;
          edgesToAdd.push({
            id: `clip-edge-${edgeSeq++}`,
            source: sourceId,
            target: String(graphNode.id),
            sourceHandle: makeOutHandle(pinId),
            targetHandle: makeInHandle(targetPinId),
            type: "colored" as any,
          } as Edge);
        }
      }

      const selectedIds = new Set(nodesRef.current.filter((node) => node.selected).map((node) => node.id));
      const duplicateResult: DuplicateNodesResult = {
        nodesToAdd: newNodes,
        edgesToAdd,
        selection: newNodes.map((node) => node.id),
        idMap: idMapStrings,
      };

      const merged = applyDuplicateSelection({
        nodes: nodesRef.current,
        edges: edgesRef.current,
        selectedIds,
        duplicate: duplicateResult,
      });

      pendingGraphUpdateRef.current = true;

      const decoratedNodes = attachNodesUpdateApi(merged.nodes as any, nodeUpdaterApi) as any;
      setNodes(decoratedNodes);
      const coloredEdges = ensureColoredEdges(merged.edges as any, decoratedNodes as any);
      setEdges(coloredEdges);
      beginHistoryActionRef.current({ type: "paste-node", summary: `${newNodes.length} node${newNodes.length === 1 ? "" : "s"} • Paste` });
      showClipboardStatus("success", `Pasted ${newNodes.length} node${newNodes.length === 1 ? "" : "s"}`);
    } catch (err) {
      console.warn("Failed to paste clipboard payload", err);
      showClipboardStatus("error", "Failed to paste nodes");
    }
  }, [ensureColoredEdges, loadTemplateDefaults, nodeUpdaterApi, paletteByType, setEdges, setNodes, showClipboardStatus]);

  const pasteFromClipboard = useCallback(async () => {
    if (typeof navigator === "undefined" || typeof navigator.clipboard?.readText !== "function") {
      showClipboardStatus("error", "Clipboard API unavailable. Use Cmd/Ctrl+V instead.");
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        showClipboardStatus("error", "Clipboard is empty");
        return;
      }
      await performPasteFromText(text);
    } catch (err) {
      console.warn("Clipboard read failed", err);
      showClipboardStatus("error", "Unable to read clipboard contents");
    }
  }, [performPasteFromText, showClipboardStatus]);

  useEffect(() => {
    if (!menu.open) {
      setCanPasteFromClipboard(false);
      return;
    }
    const readSupported = typeof navigator !== "undefined" && typeof navigator.clipboard?.readText === "function";
    setCanPasteFromClipboard(readSupported);
  }, [menu.open]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const isMod = event.metaKey || event.ctrlKey;
      if (!isMod || event.altKey || event.shiftKey) return;
      if (event.repeat) return;
      if (isEditableHotkeyTarget(event.target)) return;
      if (event.key.toLowerCase() !== "d") return;
      event.preventDefault();
      duplicateSelection();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [duplicateSelection]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleCopy = (event: ClipboardEvent) => {
      if (isEditableHotkeyTarget(event.target)) return;
      const snapshot = serializeClipboardSnapshot();
      if (!snapshot) return;
      event.preventDefault();
      try {
        event.clipboardData?.setData("application/json", snapshot.text);
        event.clipboardData?.setData("text/plain", snapshot.text);
      } catch (_err) {
        // ignore clipboardData failures
      }
      void writeClipboardText(snapshot.text);
      showClipboardStatus("success", `Copied ${snapshot.count} node${snapshot.count === 1 ? "" : "s"}`);
    };
    window.addEventListener("copy", handleCopy);
    return () => window.removeEventListener("copy", handleCopy);
  }, [serializeClipboardSnapshot, showClipboardStatus, writeClipboardText]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handlePaste = (event: ClipboardEvent) => {
      if (isEditableHotkeyTarget(event.target)) return;
      const text =
        event.clipboardData?.getData("application/json") ||
        event.clipboardData?.getData("text/plain");
      if (!text) return;
      event.preventDefault();
      void performPasteFromText(text);
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [performPasteFromText]);

  const alignSelection = useCallback(
    (alignment: AlignmentKind) => {
      setNodes((prev) => {
        const selected = prev.filter((n) => n.selected);
        if (selected.length <= 1) return prev;
        const selectedIds = new Set(selected.map((n) => n.id));
        const { nodes: alignedNodes, changed } = alignSelectedNodes(prev, selectedIds, alignment);
        if (!changed) return prev;
        const label = selected.length === 1
          ? (((selected[0]?.data as any)?.label ?? (selected[0]?.data as any)?.type ?? selected[0]?.id) as string)
          : `${selected.length} nodes`;
        beginHistoryActionRef.current({ type: `align-${alignment}`, summary: `${label} • ${ALIGNMENT_LABELS[alignment]}` });
        pendingGraphUpdateRef.current = true;
        return attachNodesUpdateApi(alignedNodes as any, nodeUpdaterApi) as any;
      });
    },
    [nodeUpdaterApi, setNodes]
  );

  const distributeSelection = useCallback(
    (distribution: DistributionKind) => {
      setNodes((prev) => {
        const selected = prev.filter((n) => n.selected);
        const minSelection = distribution === "vertical-stack" || distribution === "horizontal-stack" ? 2 : 3;
        if (selected.length < minSelection) return prev;
        const selectedIds = new Set(selected.map((n) => n.id));
        const { nodes: distributedNodes, changed } = distributeSelectedNodes(prev, selectedIds, distribution);
        if (!changed) return prev;
        const label = `${selected.length} nodes`;
        beginHistoryActionRef.current({ type: `distribute-${distribution}`, summary: `${label} • ${DISTRIBUTION_LABELS[distribution]}` });
        pendingGraphUpdateRef.current = true;
        return attachNodesUpdateApi(distributedNodes as any, nodeUpdaterApi) as any;
      });
    },
    [nodeUpdaterApi, setNodes]
  );

  // Group selected nodes into a new container node with dynamic I/O
  const groupSelected = () => {
    const selected = nodesRef.current.filter((n) => n.selected);
    if (!selected.length) return;
    const selectedIds = new Set(selected.map((n) => n.id));
    const idGen = () => String(++idCounter.current);
    const label = selected.length === 1
      ? (((selected[0]?.data as any)?.label ?? (selected[0]?.data as any)?.type ?? selected[0]?.id) as string)
      : `${selected.length} nodes`;
    beginHistoryActionRef.current({ type: "group-nodes", summary: `${label} • Group` });
    const res = utilGroupSelected(nodes as any, edges as any, selectedIds, idGen);
    setNodes(attachNodesUpdateApi(res.nodes as any, nodeUpdaterApi) as any);
    setEdges(res.edges as any);
  };

  // Ungroup a group node: move children out, restore external edges, remove group + IO nodes
  const ungroupGroup = (groupId: string) => {
    const groupNode = nodesById.get(groupId);
    const label = ((groupNode?.data as any)?.label ?? (groupNode?.data as any)?.type ?? groupId) as string;
    beginHistoryActionRef.current({ type: "ungroup-node", summary: `${label} • Ungroup` });
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
    const nextIdNum = idCounter.current + 1;
    const nextId = String(nextIdNum);
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
    const displayName = (node.data as any)?.label || item.name || payload.label || "Texture";
    beginHistoryActionRef.current({ type: "add-node", summary: `${displayName} • Add` });
    idCounter.current = nextIdNum;
    const decoratedNode = attachNodeUpdateApi(node as any, nodeUpdaterApi);
    setNodes((prev) => [...prev, decoratedNode]);
    setMenu((m) => (m.open ? { ...m, open: false } : m));
  }, [paletteByType, rf, currentParentId, loadTemplateDefaults, nodeUpdaterApi, setNodes]);

  // Build a nested tree from example keys (path segments) so the menu can render hierarchical folders
  const renderExamplesMenu = (examplesList: Array<{ key: string; label: string }>) => {
    type Node = { children: Record<string, Node>; items: Array<{ key: string; label: string }> };
    const root: Node = { children: {}, items: [] };

    for (const ex of examplesList) {
      const parts = ex.key.split("/").filter(Boolean);
      let cur = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        if (!cur.children[part]) cur.children[part] = { children: {}, items: [] };
        if (isLast) {
          cur.children[part].items.push({ key: ex.key, label: ex.label });
        }
        cur = cur.children[part];
      }
    }

    const prettify = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    const renderNode = (name: string, node: Node, pathPrefix = "") => {
      const fullPath = pathPrefix ? `${pathPrefix}/${name}` : name;
      const hasChildren = Object.keys(node.children).length > 0;
      const hasItems = node.items.length > 0;

      // If this node represents a directory (has children) render a submenu. If it only contains items, render items directly.
      if (hasChildren) {
        return (
          <MenubarSub key={fullPath}>
            <MenubarSubTrigger>{prettify(name)}</MenubarSubTrigger>
            <MenubarSubContent>
              {node.items.map((it) => (
                <MenubarItem key={it.key} onClick={() => void loadExampleGraph({ key: it.key, label: it.label })}>
                  {it.label}
                </MenubarItem>
              ))}
              {Object.keys(node.children)
                .sort()
                .map((childName) => renderNode(childName, node.children[childName], fullPath))}
            </MenubarSubContent>
          </MenubarSub>
        );
      }

      // Leaf (no nested directories) but may contain one or more items (rare: files sharing basename)
      if (!hasItems) return null;
      return (
        <Fragment key={fullPath}>
          {node.items.map((it) => (
            <MenubarItem key={it.key} onClick={() => void loadExampleGraph({ key: it.key, label: it.label })}>
              {it.label}
            </MenubarItem>
          ))}
        </Fragment>
      );
    };

    // Render top-level directories/files
    return Object.keys(root.children)
      .sort()
      .map((top) => renderNode(top, root.children[top], ""));
  };

  const versionBadgeText = `v${(APP_VERSION_INFO.version || "0.0.0").replace(/^v/i, "")}`;
  const versionTooltipParts = [
    `Version ${versionBadgeText}`,
    APP_VERSION_INFO.deploy ? `Deploy ${APP_VERSION_INFO.deploy}` : null,
    APP_VERSION_INFO.commit
      ? `Commit ${APP_VERSION_INFO.commit}${APP_VERSION_INFO.dirty ? " (dirty)" : ""}`
      : null,
    APP_VERSION_INFO.buildDate ? `Built ${APP_VERSION_INFO.buildDate}` : null,
  ].filter(Boolean) as string[];
  const versionTooltip = versionTooltipParts.join(" • ");
  const versionAriaLabel = `OpenShaderGraph ${versionBadgeText}${
    APP_VERSION_INFO.deploy ? ` (${APP_VERSION_INFO.deploy})` : ""
  }`;

  const quickExportHotkeyLabel = useMemo(
    () => formatQuickHotkeyDisplay(actionHotkeys.quickExportCode),
    [actionHotkeys.quickExportCode]
  );
  const quickExportLanguageName = useMemo(() => {
    if (!quickExportLanguage) return null;
    const match = languages.find((lang) => lang.key === quickExportLanguage);
    return match ? match.name : null;
  }, [languages, quickExportLanguage]);

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
            <MenubarSeparator />
              <MenubarSub>
                <MenubarSubTrigger>Export</MenubarSubTrigger>
                <MenubarSubContent>
                  {languages.map((lang) => (
                    <MenubarItem key={lang.key} onClick={() => void handleExportLanguage(lang.key)}>
                      {lang.name}
                    </MenubarItem>
                  ))}
                </MenubarSubContent>
              </MenubarSub>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>Edit</MenubarTrigger>
            <MenubarContent>
              <MenubarItem
                disabled={!canUndo}
                onClick={() => {
                  if (!canUndo) return;
                  undoHistory();
                }}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span>Undo</span>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-xs">{formatHistoryPreview(peekUndo)}</span>
                    <span className="text-[10px] uppercase">⌘Z</span>
                  </div>
                </div>
              </MenubarItem>
              <MenubarItem
                disabled={!canRedo}
                onClick={() => {
                  if (!canRedo) return;
                  redoHistory();
                }}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span>Redo</span>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-xs">{formatHistoryPreview(peekRedo)}</span>
                    <span className="text-[10px] uppercase">⇧⌘Z</span>
                  </div>
                </div>
              </MenubarItem>
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
              {renderExamplesMenu(examples)}
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      </div>
      <div className="flex-1">
        <div className="flex items-center rounded-md border border-border/40 bg-muted/40 px-3 py-1.5 shadow-sm">
          <Breadcrumb className="w-full">
            <BreadcrumbList className="text-xs">
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
      </div>
      <div className="flex items-center gap-2">
        {fileSystemAccessSupported && canQuickExport ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleQuickExport()}
            className="inline-flex items-center gap-2"
            title={`Quick Export${quickExportLanguageName ? ` (${quickExportLanguageName})` : ""} – ${quickExportHotkeyLabel}`}
          >
            <span>Quick Export</span>
            <span className="text-[10px] uppercase text-muted-foreground">{quickExportHotkeyLabel}</span>
          </Button>
        ) : null}
        <Button
          size="sm"
          variant={showDocsPanel ? "default" : "secondary"}
          onClick={() => setShowDocsPanel((v) => !v)}
          className="inline-flex items-center gap-1"
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span>Docs</span>
        </Button>
        <a
          href="https://github.com/omid3098/openshadergraph"
          target="_blank"
          rel="noreferrer"
          aria-label="OpenShaderGraph on GitHub"
          className="text-muted-foreground hover:text-foreground"
        >
          <Github className="h-4 w-4" />
        </a>
        <span
          className="inline-flex items-center gap-1 rounded-md border bg-muted/70 px-2 py-0.5 text-[11px] text-foreground"
          title={versionTooltip}
          aria-label={versionAriaLabel}
        >
          <span className="font-medium leading-none">{versionBadgeText}</span>
          {APP_VERSION_INFO.deploy ? (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none">
              {APP_VERSION_INFO.deploy}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );

  // SidebarMenus removed; moved to header menubar

  // After a graph is loaded/created and the view path is applied, fit the viewport to visible nodes once
  useEffect(() => {
    if (!fitAfterLoadRef.current) return;
    if (!visibleNodeIds.length) return;
    // Defer to ensure nodes are mounted and measured
    let frame: number | null = null;
    let frame2: number | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let timeout2: ReturnType<typeof setTimeout> | null = null;

    const run = () => {
      try {
        fitViewToNodeIds(visibleNodeIds);
      } finally {
        fitAfterLoadRef.current = false;
      }
    };

    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      frame = window.requestAnimationFrame(() => {
        frame2 = window.requestAnimationFrame(run);
      });
    } else {
      timeout = setTimeout(() => {
        timeout2 = setTimeout(run, 0);
      }, 0);
    }

    return () => {
      if (typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
        if (frame !== null) window.cancelAnimationFrame(frame);
        if (frame2 !== null) window.cancelAnimationFrame(frame2);
      }
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      if (timeout2 !== null) {
        clearTimeout(timeout2);
      }
    };
  }, [fitViewToNodeIds, visibleNodeIds, currentParentId]);

  // Load and persist documentation panel width
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const w = await persistGet<number>("docs.width");
      if (cancelled) return;
      if (typeof w === "number" && Number.isFinite(w) && w >= 320) setDocsWidth(w);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    void persistSet("docs.width", docsWidth);
  }, [docsWidth]);

  const onDocsResizeMove = useCallback((e: globalThis.MouseEvent) => {
    if (!docsResizing.current) return;
    const dx = docsStartX.current - e.clientX; // dragging left handle; increasing dx widens panel
    const minW = 320;
    const maxW = Math.max(window.innerWidth - 160, minW);
    const next = Math.min(Math.max(docsStartW.current + dx, minW), maxW);
    setDocsWidth(next);
  }, []);

  const onDocsResizeStop = useCallback(() => {
    docsResizing.current = false;
    window.removeEventListener("mousemove", onDocsResizeMove as EventListener);
    window.removeEventListener("mouseup", onDocsResizeStop as EventListener);
    setIsDocsResizing(false);
  }, [onDocsResizeMove]);

  const onDocsResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    docsResizing.current = true;
    docsStartX.current = e.clientX;
    docsStartW.current = docsWidth;
    window.addEventListener("mousemove", onDocsResizeMove as EventListener);
    window.addEventListener("mouseup", onDocsResizeStop as EventListener);
    setIsDocsResizing(true);
  };

  // Note: listeners are only attached during active resize and removed on mouseup

  return (
    <SettingsProvider value={settingsValue}>
      <GraphStateProvider value={graphStateValue}>
        <AppShell
          header={Header}
          sidebarContent={renderSidebar}
          theme={theme}
          onToggleTheme={toggleTheme}
        >
          {activeView === "settings" ? (
            <SettingsPage
              curveMode={curveMode}
              onCurveModeChange={setCurveMode}
              theme={theme}
              onThemeChange={setTheme}
              quickHotkeys={quickHotkeysForSettings}
              onQuickHotkeysChange={handleQuickHotkeysChange}
              actionHotkeys={actionHotkeys}
              onActionHotkeysChange={setActionHotkeys}
              palette={palette}
              assetLibraries={assetLibraries}
              onAssetLibrariesChange={setAssetLibraries}
            />
          ) : (
            <div className="w-full h-full flex relative">
              <div
                ref={flowContainerRef}
                className="h-full relative transition-[width] duration-200 ease-linear"
                style={{ width: showDocsPanel ? `calc(100% - ${docsWidth}px)` : "100%" }}
              >
              <ReactFlow
                style={{ width: "100%", height: "100%" }}
                nodes={visibleNodes}
                edges={visibleEdges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                defaultEdgeOptions={{ type: "colored" as any }}
                deleteKeyCode={["Backspace", "Delete"]}
                isValidConnection={isValidConnectionCb}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={onConnect}
                onConnectStart={(e: any, params: any) => {
                  try {
                    connectCompletedRef.current = false;
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
                    if (connectCompletedRef.current) return;
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
                    connectCompletedRef.current = false;
                    connectDragRef.current = null;
                  }
                }}
                onNodeDragStart={(_e, node) => {
                  try {
                    if (!dragSnapshotRef.current) {
                      const snapshotter = captureSnapshotFnRef.current;
                      if (snapshotter) dragSnapshotRef.current = snapshotter();
                    }
                    draggingNodeIdsRef.current.add(node.id);
                    pendingGraphUpdateRef.current = true;
                  } catch (_err) {
                    // ignore
                  }
                }}
                onNodeDragStop={() => {
                  try {
                    pendingGraphUpdateRef.current = true;
                  } catch (_err) {
                    // ignore
                  }
                }}
                panOnDrag={[1]}
                selectionOnDrag
                selectionMode={SelectionMode.Partial}
                onNodeDoubleClick={(e, node) => {
                  const t = (node.data as any)?.type;
                  if (t === "group" || t === "surface" || t === "vertex_pass" || t === "fragment_pass") {
                    setViewPath((p) => [...p, node.id]);
                  }
                }}
                onPaneClick={() => {
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
                onEdgeDoubleClick={handleEdgeDoubleClick}
                onEdgeContextMenu={(e, edge) => {
                  e.preventDefault();
                  setMenuPaletteOverride(null);
                  setMenu({ open: true, kind: "edge", x: e.clientX, y: e.clientY, targetId: edge.id });
                }}
                connectionLineType={curveMode === "default" ? "smoothstep" : curveMode as any}
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
                  pannable
                  zoomable
                  onClick={(_event, position) => {
                    if (!position) return;
                    try {
                      const currentZoom = rf.getZoom();
                      rf.setCenter(position.x, position.y, { zoom: currentZoom, duration: 200 });
                    } catch (_err) {
                      // ignore viewport sync failures
                    }
                  }}
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
                onCopySelection={(targetId) => {
                  void copySelectionManual(targetId);
                  setMenu((m) => ({ ...m, open: false }));
                  setMenuPaletteOverride(null);
                }}
                onDuplicateSelection={(targetId) => {
                  duplicateSelection(targetId ? { targetId } : undefined);
                  setMenu((m) => ({ ...m, open: false }));
                  setMenuPaletteOverride(null);
                }}
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
                onAlignSelected={(alignment) => {
                  alignSelection(alignment);
                  setMenu((m) => ({ ...m, open: false }));
                  setMenuPaletteOverride(null);
                }}
                onDistributeSelected={(distribution) => {
                  distributeSelection(distribution);
                  setMenu((m) => ({ ...m, open: false }));
                  setMenuPaletteOverride(null);
                }}
                onPasteFromClipboard={() => {
                  void pasteFromClipboard();
                  setMenu((m) => ({ ...m, open: false }));
                  setMenuPaletteOverride(null);
                }}
                canPaste={canPasteFromClipboard}
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
              {clipboardStatus && (
                <div
                  className={cn(
                    "fixed bottom-4 right-4 z-[100] rounded-md border bg-popover px-3 py-2 text-sm shadow-lg",
                    clipboardStatus.kind === "error" ? "border-destructive text-destructive" : "border-border text-foreground"
                  )}
                >
                  {clipboardStatus.message}
                </div>
              )}
              </div>
              {/* Documentation Panel resize handle */}
              {showDocsPanel ? (
                <div
                  role="separator"
                  aria-orientation="vertical"
                  title="Drag to resize"
                  onMouseDown={onDocsResizeStart}
                  className="absolute top-0 h-full w-2 cursor-col-resize bg-transparent"
                  style={{ left: `calc(100% - ${docsWidth}px - 2px)` }}
                />
              ) : null}

              {/* Resize overlay to capture mouse events over iframe */}
              {isDocsResizing ? (
                <div
                  className="fixed inset-0 z-[999] cursor-col-resize"
                  style={{ pointerEvents: "auto", background: "transparent" }}
                  onMouseMove={(e) => onDocsResizeMove(e.nativeEvent as unknown as globalThis.MouseEvent)}
                  onMouseUp={onDocsResizeStop}
                />
              ) : null}

              {/* Documentation Panel */}
              <div
                className="h-full flex-shrink-0 border-l bg-card transition-[width] duration-200 ease-linear"
                style={{ width: showDocsPanel ? `${docsWidth}px` : "0px" }}
              >
                {showDocsPanel && (
                  <DocumentationPanel
                    onLoadExample={handleLoadExampleGraph}
                    className="w-full"
                  />
                )}
              </div>
            </div>
          )}
        </AppShell>
      </GraphStateProvider>
    </SettingsProvider>
  );
}
export default App;
