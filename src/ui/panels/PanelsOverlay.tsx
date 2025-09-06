import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DockLayout } from "../layout/DockLayout";
import { PreviewPanel } from "@/components/PreviewPanel";
import { CompilePanel } from "@/components/CompilePanel";
import { GraphDataPanel } from "@/components/GraphDataPanel";
import { PropertiesPanel } from "@/components/PropertiesPanel";
import { cn } from "@/lib/utils";
import { buildDockItemDescriptors } from "./items";

type PanelsOverlayProps = {
  graph: unknown;
  className?: string;
  /** test helper: force simple tabs instead of flexlayout */
  forceTabsFallback?: boolean;
  /** test/helper: omit heavy WebGL preview in constrained envs */
  includePreview?: boolean;
  /** test/helper: omit compile panel */
  includeCompile?: boolean;
  /** test/helper: omit graph data panel */
  includeGraphData?: boolean;
};

/**
 * PanelsOverlay renders a single, resizable right-side dock that hosts
 * Preview, Compile Output, and Graph Data as dockable tabs.
 * It lives outside the ReactFlow canvas to prevent overlap and z-index issues.
 */
export function PanelsOverlay({ graph, className, forceTabsFallback, includePreview = true, includeCompile = true, includeGraphData = true }: PanelsOverlayProps) {
  const [width, setWidth] = useState<number>(() => {
    if (typeof localStorage === "undefined") return 520;
    const v = Number(localStorage.getItem("dock.width"));
    return Number.isFinite(v) && v >= 320 ? v : 520;
  });
  const resizing = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  // Panels enabled state (Properties, Compile, Graph Data, Preview)
  const [panels, setPanels] = useState<{ properties: boolean; compile: boolean; graphdata: boolean; preview: boolean }>(() => {
    if (typeof localStorage === "undefined") return { properties: true, compile: includeCompile, graphdata: includeGraphData, preview: includePreview };
    try {
      const raw = localStorage.getItem("dock.panels.state");
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          properties: parsed.properties !== false,
          compile: parsed.compile !== false,
          graphdata: parsed.graphdata !== false,
          preview: parsed.preview !== false,
        };
      }
    } catch {
      // ignore
    }
    return { properties: true, compile: includeCompile, graphdata: includeGraphData, preview: includePreview };
  });

  useEffect(() => {
    if (typeof localStorage !== "undefined") localStorage.setItem("dock.panels.state", JSON.stringify(panels));
  }, [panels]);

  const [menu, setMenu] = useState<{ open: boolean; x: number; y: number }>({ open: false, x: 0, y: 0 });

  useEffect(() => {
    if (typeof localStorage !== "undefined") localStorage.setItem("dock.width", String(width));
  }, [width]);
  // no vertical split anymore

  const onMove = useCallback((e: MouseEvent) => {
    if (!resizing.current) return;
    const dx = startX.current - e.clientX; // dragging left handle; increasing dx widens dock
    const next = Math.min(Math.max(startW.current + dx, 320), Math.max(window.innerWidth - 160, 320));
    setWidth(next);
  }, []);
  const stop = useCallback(() => {
    resizing.current = false;
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", stop);
  }, [onMove]);
  const start = (e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = true;
    startX.current = e.clientX;
    startW.current = width;
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", stop);
  };

  const items = useMemo(() => {
    const desc = buildDockItemDescriptors({ includePreview: panels.preview, includeCompile: panels.compile, includeGraphData: panels.graphdata, includeProperties: panels.properties });
    return desc.map((d) => ({
      id: d.id,
      name: d.name,
      render: () => d.id === "properties" ? (
        <PropertiesPanel variant="docked" />
      ) : d.id === "compile" ? (
        <CompilePanel variant="docked" graph={graph} />
      ) : d.id === "graphdata" ? (
        <GraphDataPanel variant="docked" data={graph} />
      ) : (
        <PreviewPanel variant="docked" graph={graph} />
      ),
    }));
  }, [graph, panels]);

  // removed vertical resizing code

  return (
    <div className={cn("fixed top-0 right-0 h-screen z-40 pointer-events-none", className)} style={{ width }}>
      {/* resize handle on the left edge */}
      <div
        role="separator"
        aria-orientation="vertical"
        title="Drag to resize"
        onMouseDown={start}
        className="absolute left-[-4px] top-0 h-full w-2 cursor-col-resize bg-transparent pointer-events-auto"
      />
      <div id="dock-container" className="w-full h-full bg-background border-l pointer-events-auto">
        <DockLayout items={items} forceTabsFallback={forceTabsFallback} className="w-full h-full" onHeaderContextMenu={(e) => {
          setMenu({ open: true, x: e.clientX, y: e.clientY });
        }} />
      </div>
      {/* Simple context menu to toggle panels */}
      {menu.open ? (
        <PanelToggleMenu
          x={menu.x}
          y={menu.y}
          state={panels}
          onChange={(next) => setPanels(next)}
          onClose={() => setMenu({ open: false, x: 0, y: 0 })}
        />
      ) : null}
    </div>
  );
}

export default PanelsOverlay;

function PanelToggleMenu({ x, y, state, onChange, onClose }: { x: number; y: number; state: { properties: boolean; compile: boolean; graphdata: boolean; preview: boolean }; onChange: (s: { properties: boolean; compile: boolean; graphdata: boolean; preview: boolean }) => void; onClose: () => void }) {
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { const target = e.target as HTMLElement | null; if (!target?.closest?.("[data-panel-menu]")) onClose(); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);
  // Position relative to the dock container so it aligns with right panel
  const [left, top] = (() => {
    const container = document.getElementById("dock-container");
    if (!container) return [x, y] as const;
    const rect = container.getBoundingClientRect();
    return [x - rect.left, y - rect.top] as const;
  })();
  const Item = ({ id, label }: { id: keyof typeof state; label: string }) => (
    <label className="flex items-center gap-2 px-3 py-1 text-xs cursor-pointer select-none hover:bg-muted rounded">
      <input type="checkbox" checked={state[id]} onChange={(e) => onChange({ ...state, [id]: e.target.checked })} />
      {label}
    </label>
  );
  return (
    <div data-panel-menu className="absolute z-50 pointer-events-auto bg-background border rounded-md shadow-md text-foreground" style={{ left, top }}>
      <div className="p-2">
        <div className="px-2 pb-1 text-[11px] text-muted-foreground">Panels</div>
        <Item id="properties" label="Properties" />
        <Item id="compile" label="Compile" />
        <Item id="graphdata" label="Graph Data" />
        <div className="h-[1px] bg-border my-1" />
        <Item id="preview" label="Preview (bottom)" />
      </div>
    </div>
  );
}
