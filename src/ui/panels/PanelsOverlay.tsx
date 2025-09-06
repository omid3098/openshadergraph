import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DockLayout } from "../layout/DockLayout";
import { PreviewPanel } from "@/components/PreviewPanel";
import { CompilePanel } from "@/components/CompilePanel";
import { GraphDataPanel } from "@/components/GraphDataPanel";
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

  useEffect(() => {
    if (typeof localStorage !== "undefined") localStorage.setItem("dock.width", String(width));
  }, [width]);

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
    const desc = buildDockItemDescriptors({ includePreview, includeCompile, includeGraphData });
    return desc.map((d) => ({
      id: d.id,
      name: d.name,
      render: () => d.id === "preview" ? (
        <PreviewPanel variant="docked" graph={graph} />
      ) : d.id === "compile" ? (
        <CompilePanel variant="docked" graph={graph} />
      ) : (
        <GraphDataPanel variant="docked" data={graph} />
      ),
    }));
  }, [graph, includePreview, includeCompile, includeGraphData]);

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
      <div className="w-full h-full bg-background border-l pointer-events-auto">
        <DockLayout items={items} forceTabsFallback={forceTabsFallback} className="w-full h-full" />
      </div>
    </div>
  );
}

export default PanelsOverlay;
