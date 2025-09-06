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
  const [topHeightRatio, setTopHeightRatio] = useState<number>(() => {
    if (typeof localStorage === "undefined") return 0.6; // 60% tabs, 40% preview
    const v = Number(localStorage.getItem("dock.topRatio"));
    return Number.isFinite(v) && v > 0.2 && v < 0.85 ? v : 0.6;
  });
  const resizing = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);
  const resizingY = useRef(false);
  const startY = useRef(0);
  const startRatio = useRef(0.6);

  useEffect(() => {
    if (typeof localStorage !== "undefined") localStorage.setItem("dock.width", String(width));
  }, [width]);
  useEffect(() => {
    if (typeof localStorage !== "undefined") localStorage.setItem("dock.topRatio", String(topHeightRatio));
  }, [topHeightRatio]);

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
    const desc = buildDockItemDescriptors({ includePreview: false, includeCompile, includeGraphData, includeProperties: true });
    return desc.map((d) => ({
      id: d.id,
      name: d.name,
      render: () => d.id === "properties" ? (
        <PropertiesPanel variant="docked" />
      ) : d.id === "compile" ? (
        <CompilePanel variant="docked" graph={graph} />
      ) : (
        <GraphDataPanel variant="docked" data={graph} />
      ),
    }));
  }, [graph, includeCompile, includeGraphData]);

  const onMoveY = useCallback((e: MouseEvent) => {
    if (!resizingY.current) return;
    // Compute next ratio based on pointer movement within dock container
    const container = document.getElementById("dock-container");
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const dy = e.clientY - startY.current;
    const height = rect.height;
    const currentTopHeight = startRatio.current * height;
    let nextTop = currentTopHeight + dy;
    const minTop = Math.max(160, 0.2 * height);
    const maxTop = Math.min(height - 160, 0.85 * height);
    nextTop = Math.max(minTop, Math.min(maxTop, nextTop));
    setTopHeightRatio(nextTop / height);
  }, []);
  const stopY = useCallback(() => {
    resizingY.current = false;
    window.removeEventListener("mousemove", onMoveY);
    window.removeEventListener("mouseup", stopY);
  }, [onMoveY]);
  const startYResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const container = document.getElementById("dock-container");
    if (!container) return;
    resizingY.current = true;
    startY.current = e.clientY;
    startRatio.current = topHeightRatio;
    window.addEventListener("mousemove", onMoveY);
    window.addEventListener("mouseup", stopY);
  };

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
      <div id="dock-container" className="w-full h-full bg-background border-l pointer-events-auto flex flex-col">
        <div style={{ height: `${topHeightRatio * 100}%` }} className="min-h-[160px]">
          <DockLayout items={items} forceTabsFallback={forceTabsFallback} className="w-full h-full" />
        </div>
        {/* Horizontal resizer between tabs and preview */}
        <div
          role="separator"
          aria-orientation="horizontal"
          title="Drag to resize"
          onMouseDown={startYResize}
          className="h-[6px] cursor-row-resize bg-transparent hover:bg-muted/60"
        />
        <div className="flex-1 min-h-[160px] overflow-hidden">
          {includePreview ? <PreviewPanel variant="docked" graph={graph} /> : null}
        </div>
      </div>
    </div>
  );
}

export default PanelsOverlay;
