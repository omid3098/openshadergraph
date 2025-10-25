import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { persistGet, persistSet } from "@/lib/storage";

export const OVERLAY_IDS = ["preview", "compile", "graphdata", "assets", "properties"] as const;

export type OverlayId = (typeof OVERLAY_IDS)[number];

export type OverlayState = {
  id: OverlayId;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  zIndex: number;
};

export type OverlayStateMap = Record<OverlayId, OverlayState>;

export type OverlayBoundsUpdate = Partial<Pick<OverlayState, "x" | "y" | "width" | "height">>;

type OverlaySnapshot = Record<OverlayId, Partial<OverlayState>>;

type OverlayContextValue = {
  overlays: OverlayStateMap;
  hydrated: boolean;
  toggleOverlay: (id: OverlayId, nextVisibility?: boolean) => void;
  setOverlayVisibility: (id: OverlayId, visible: boolean) => void;
  updateOverlayBounds: (id: OverlayId, bounds: OverlayBoundsUpdate) => void;
  bringToFront: (id: OverlayId) => void;
};

const STORAGE_KEY = "ui.overlays.state";
const MIN_WIDTH = 320;
const MIN_HEIGHT = 220;

const DEFAULT_STATE: OverlayStateMap = {
  preview: { id: "preview", x: 960, y: 32, width: 420, height: 320, visible: true, zIndex: 2 },
  compile: { id: "compile", x: 960, y: 372, width: 420, height: 320, visible: false, zIndex: 1 },
  graphdata: { id: "graphdata", x: 520, y: 48, width: 380, height: 320, visible: false, zIndex: 1 },
  assets: { id: "assets", x: 560, y: 420, width: 360, height: 360, visible: false, zIndex: 1 },
  properties: { id: "properties", x: 40, y: 48, width: 360, height: 360, visible: false, zIndex: 1 },
};

const OverlayContext = createContext<OverlayContextValue | null>(null);

function cloneState(state: OverlayStateMap): OverlayStateMap {
  return {
    preview: { ...state.preview },
    compile: { ...state.compile },
    graphdata: { ...state.graphdata },
    assets: { ...state.assets },
    properties: { ...state.properties },
  };
}

function normalizeOverlay(state: OverlayState): OverlayState {
  return {
    ...state,
    width: Number.isFinite(state.width) && state.width > MIN_WIDTH ? state.width : MIN_WIDTH,
    height: Number.isFinite(state.height) && state.height > MIN_HEIGHT ? state.height : MIN_HEIGHT,
    x: Number.isFinite(state.x) ? state.x : 0,
    y: Number.isFinite(state.y) ? state.y : 0,
    zIndex: Number.isFinite(state.zIndex) && state.zIndex > 0 ? state.zIndex : 1,
    visible: Boolean(state.visible),
  };
}

function mergeSnapshot(snapshot: OverlaySnapshot | null): OverlayStateMap {
  if (!snapshot) return cloneState(DEFAULT_STATE);
  const next = cloneState(DEFAULT_STATE);
  for (const key of OVERLAY_IDS) {
    const overrides = snapshot[key];
    if (!overrides) continue;
    next[key] = normalizeOverlay({ ...next[key], ...overrides, id: key });
  }
  return next;
}

function highestZIndex(state: OverlayStateMap): number {
  return Math.max(...OVERLAY_IDS.map((id) => state[id].zIndex));
}

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OverlayStateMap>(() => cloneState(DEFAULT_STATE));
  const [hydrated, setHydrated] = useState(false);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const saved = await persistGet<OverlaySnapshot>(STORAGE_KEY);
        if (cancelled) return;
        if (saved) {
          setState((prev) => {
            // If state already diverged (e.g., user toggled before hydration), merge persisted values on top
            const merged = mergeSnapshot(saved);
            const next = cloneState(merged);
            for (const key of OVERLAY_IDS) {
              if (!prev[key]) continue;
              // Preserve any runtime visibility overrides when persistence lacks explicit value
              if (typeof saved[key]?.visible === "undefined") {
                next[key].visible = prev[key].visible;
              }
              // Preserve in-flight z-order bumps that happened pre-hydration
              if (typeof saved[key]?.zIndex === "undefined") {
                next[key].zIndex = prev[key].zIndex;
              }
            }
            return next;
          });
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (persistTimer.current) {
      clearTimeout(persistTimer.current);
    }
    persistTimer.current = setTimeout(() => {
      persistTimer.current = null;
      void persistSet<OverlaySnapshot>(STORAGE_KEY, state);
    }, 150);
  }, [state, hydrated]);

  useEffect(() => {
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, []);

  const toggleOverlay = useCallback((id: OverlayId, nextVisibility?: boolean) => {
    setState((prev) => {
      const current = prev[id];
      const targetVisible = typeof nextVisibility === "boolean" ? nextVisibility : !current.visible;
      if (targetVisible && current.visible) return prev;
      const updated = cloneState(prev);
      const entry = { ...updated[id] };
      entry.visible = targetVisible;
      if (targetVisible) {
        entry.zIndex = highestZIndex(prev) + 1;
      }
      updated[id] = entry;
      return updated;
    });
  }, []);

  const setOverlayVisibility = useCallback((id: OverlayId, visible: boolean) => {
    toggleOverlay(id, visible);
  }, [toggleOverlay]);

  const bringToFront = useCallback((id: OverlayId) => {
    setState((prev) => {
      const current = prev[id];
      const max = highestZIndex(prev);
      if (current.zIndex === max + 1) return prev;
      const updated = cloneState(prev);
      updated[id] = { ...current, zIndex: max + 1 };
      return updated;
    });
  }, []);

  const updateOverlayBounds = useCallback((id: OverlayId, bounds: OverlayBoundsUpdate) => {
    if (!bounds) return;
    setState((prev) => {
      const current = prev[id];
      if (!current) return prev;
      const updated = cloneState(prev);
      const entry = { ...current };
      if (typeof bounds.x === "number" && Number.isFinite(bounds.x)) entry.x = bounds.x;
      if (typeof bounds.y === "number" && Number.isFinite(bounds.y)) entry.y = bounds.y;
      if (typeof bounds.width === "number" && Number.isFinite(bounds.width)) entry.width = Math.max(bounds.width, MIN_WIDTH);
      if (typeof bounds.height === "number" && Number.isFinite(bounds.height)) entry.height = Math.max(bounds.height, MIN_HEIGHT);
      updated[id] = normalizeOverlay(entry);
      return updated;
    });
  }, []);

  const value = useMemo<OverlayContextValue>(() => {
    return {
      overlays: state,
      hydrated,
      toggleOverlay,
      setOverlayVisibility,
      updateOverlayBounds,
      bringToFront,
    };
  }, [state, hydrated, toggleOverlay, setOverlayVisibility, updateOverlayBounds, bringToFront]);

  return (
    <OverlayContext.Provider value={value}>
      {children}
    </OverlayContext.Provider>
  );
}

export function useOverlay(id: OverlayId): {
  state: OverlayState;
  hydrated: boolean;
  toggle: (nextVisibility?: boolean) => void;
  setVisible: (visible: boolean) => void;
  updateBounds: (bounds: OverlayBoundsUpdate) => void;
  bringToFront: () => void;
} {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error("useOverlay must be used within an OverlayProvider");
  const overlay = ctx.overlays[id];
  return {
    state: overlay,
    hydrated: ctx.hydrated,
    toggle: (nextVisibility?: boolean) => ctx.toggleOverlay(id, nextVisibility),
    setVisible: (visible: boolean) => ctx.setOverlayVisibility(id, visible),
    updateBounds: (bounds: OverlayBoundsUpdate) => ctx.updateOverlayBounds(id, bounds),
    bringToFront: () => ctx.bringToFront(id),
  };
}

export function useOverlayManager(): OverlayContextValue {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error("OverlayContext unavailable");
  return ctx;
}
