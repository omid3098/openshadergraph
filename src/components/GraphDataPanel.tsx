import React, { useCallback, useMemo, useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import CodeBlock from "./CodeBlock";

type GraphDataPanelProps = {
  data: unknown;
  className?: string;
  variant?: "overlay" | "docked" | "node";
};

function useGraphJson(data: unknown) {
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
  return { pretty, copied, copyToClipboard };
}

function GraphDataPanelDocked({ data, className, asNode = false }: { data: unknown; className?: string; asNode?: boolean }) {
  const { pretty, copied, copyToClipboard } = useGraphJson(data);

  if (asNode) {
    return (
      <div
        className={cn("h-full flex flex-col nodrag nowheel", className)}
        data-node-interactive
        onPointerDownCapture={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
      >
        <div className="px-3 py-2 border-b flex items-center justify-end gap-2">
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
        <div className="flex-1 overflow-hidden">
          <CodeBlock code={pretty} language="json" className="h-full" />
        </div>
      </div>
    );
  }

  return (
    <Card
      className={cn("relative h-full nodrag nowheel", className)}
      data-node-interactive
      onPointerDownCapture={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
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
  if (variant === "node") return <GraphDataPanelDocked data={data} className={className} asNode />;
  return <GraphDataPanelOverlay data={data} className={className} />;
}

function GraphDataPanelOverlay({ data, className }: { data: unknown; className?: string }) {
  const { pretty, copied, copyToClipboard } = useGraphJson(data);
  return (
    <div className={cn("h-full flex flex-col", className)}>
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Graph JSON</span>
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
      <div className="flex-1 overflow-auto">
        <CodeBlock code={pretty} language="json" className="h-full" />
      </div>
    </div>
  );
}

export default GraphDataPanel;
