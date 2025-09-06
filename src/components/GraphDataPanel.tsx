import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

type GraphDataPanelProps = {
  data: unknown;
  className?: string;
  variant?: "overlay" | "docked";
};

function GraphDataPanelDocked({ data, className }: { data: unknown; className?: string }) {
  const pretty = useMemo(() => {
    try { return JSON.stringify(data, null, 2); } catch { return String(data ?? ""); }
  }, [data]);
  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm">Graph Data</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex-1 overflow-auto">
        <div className="rounded-md bg-muted p-2 h-full overflow-auto">
          <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words">{pretty}</pre>
        </div>
      </CardContent>
    </Card>
  );
}

export function GraphDataPanel({ data, className, variant = "overlay" }: GraphDataPanelProps) {
  if (variant === "docked") return <GraphDataPanelDocked data={data} className={className} />;
  return <GraphDataPanelOverlay data={data} className={className} />;
}

function GraphDataPanelOverlay({ data, className }: { data: unknown; className?: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState<number>(() => {
    const stored = typeof localStorage !== "undefined" ? Number(localStorage.getItem("graphPanel.width")) : 0;
    return Number.isFinite(stored) && stored > 240 ? stored : 420;
  });
  const resizing = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("graphPanel.width", String(width));
    }
  }, [width]);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!resizing.current) return;
    const dx = startX.current - e.clientX; // dragging left handle; increasing dx widens panel
    const next = Math.min(Math.max(startW.current + dx, 280), Math.max(window.innerWidth - 120, 280));
    setWidth(next);
  }, []);

  const onMouseUp = useCallback(() => {
    resizing.current = false;
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  }, [onMouseMove]);

  const onHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = true;
    startX.current = e.clientX;
    startW.current = width;
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const pretty = useMemo(() => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data ?? "");
    }
  }, [data]);

  if (collapsed) {
    return (
      <div className={cn("absolute right-2 top-2 z-40", className)}>
        <Button size="sm" variant="outline" onClick={() => setCollapsed(false)} aria-label="Open graph data">
          Graph Data
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn("fixed top-2 right-2 z-40 pointer-events-none", className)}
      style={{ width: width + 4 /* account for handle thickness */ }}
    >
      {/* Resize Handle (left edge) */}
      <div
        role="separator"
        aria-orientation="vertical"
        title="Drag to resize"
        onMouseDown={onHandleMouseDown}
        className="absolute left-[-4px] top-0 h-full w-2 cursor-col-resize bg-transparent pointer-events-auto"
      />
      <Card className="pointer-events-auto">
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Graph Data</CardTitle>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" aria-label="Collapse" onClick={() => setCollapsed(true)}>
              ▸
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="rounded-md bg-muted p-2 overflow-auto max-h-[60vh]">
            <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words">
              {pretty}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default GraphDataPanel;
