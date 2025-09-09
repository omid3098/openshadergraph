import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import CodeBlock from "./CodeBlock";

type GraphDataPanelProps = {
  data: unknown;
  className?: string;
  variant?: "overlay" | "docked";
};

function GraphDataPanelDocked({ data, className }: { data: unknown; className?: string }) {
  const pretty = useMemo(() => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data ?? "");
    }
  }, [data]);
  const [copied, setCopied] = useState(false);
  const copyToClipboard = useCallback(async () => {
    const text = pretty;
    if (!text) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const el = document.createElement("textarea");
        el.value = text;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.focus();
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // noop
    }
  }, [pretty]);

  return (
    <Card className={cn("relative h-full", className)}>
      <CodeBlock code={pretty} language="json" className="h-full pt-10" />
      <div className="absolute top-2 right-2 flex items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          aria-label="Copy graph data"
          title="Copy"
          onClick={copyToClipboard}
          disabled={!pretty}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
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
  const [copied, setCopied] = useState(false);

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

  const copyToClipboard = useCallback(async () => {
    const text = pretty;
    if (!text) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const el = document.createElement("textarea");
        el.value = text;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.focus();
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // noop
    }
  }, [pretty]);

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
      <Card className="pointer-events-auto relative">
        <CodeBlock code={pretty} language="json" className="h-[60vh] pt-10" />
        <div className="absolute top-2 right-2 flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Copy graph data"
            title="Copy"
            onClick={copyToClipboard}
            disabled={!pretty}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
          <Button size="icon" variant="ghost" aria-label="Collapse" onClick={() => setCollapsed(true)}>
            ▸
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default GraphDataPanel;
