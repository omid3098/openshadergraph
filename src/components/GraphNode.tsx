import React, { useCallback, useMemo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position, useNodeId, useReactFlow, useStore } from "@xyflow/react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { cn } from "@/lib/utils";
import { Input } from "./ui/input";

type Pin = { id?: number; name: string; type: any; value?: any };

export type GraphNodeData = {
  label?: string;
  type?: string;
  template?: {
    id?: number;
    type: string;
    name?: string;
    inputs?: Pin[];
    outputs?: Pin[];
  };
};

export function GraphNode({ data }: NodeProps<GraphNodeData>) {
  const name = data?.label ?? data?.type ?? "Node";
  const inputs: Pin[] = Array.isArray(data?.template?.inputs) ? data!.template!.inputs! : [];
  const outputs: Pin[] = Array.isArray(data?.template?.outputs) ? data!.template!.outputs! : [];
  const nodeId = useNodeId();
  const rf = useReactFlow();
  // Subscribe to edges so this node re-renders when connections change
  const edges = useStore((s) => s.edges);

  const isConnected = useCallback(
    (pid: number) => {
      if (!nodeId) return false;
      const handleId = `in-${pid}`;
      return edges.some((e) => e.target === nodeId && e.targetHandle === handleId);
    },
    [edges, nodeId]
  );

  const updateInputValue = useCallback(
    (pinId: number, next: number[] | string | number) => {
      if (!nodeId) return;
      rf.setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== nodeId) return n;
          const tpl = (n.data as any)?.template;
          if (!tpl || !Array.isArray(tpl.inputs)) return n;
          const idx = tpl.inputs.findIndex((p: any, i: number) => (typeof p.id === "number" ? p.id === pinId : i === pinId));
          if (idx < 0) return n;
          const nextTpl = { ...tpl, inputs: tpl.inputs.map((p: any, i: number) => (i === idx ? { ...p, value: Array.isArray(next) ? next : typeof next === "number" ? [next] : next } : p)) };
          return { ...n, data: { ...(n.data as any), template: nextTpl } } as any;
        })
      );
    },
    [nodeId, rf]
  );

  const parseHex = (hex: string): [number, number, number] => {
    const m = hex.replace("#", "");
    const r = parseInt(m.slice(0, 2), 16) / 255;
    const g = parseInt(m.slice(2, 4), 16) / 255;
    const b = parseInt(m.slice(4, 6), 16) / 255;
    return [r, g, b];
  };

  const fmtHex = (rgb01: [number, number, number]) => {
    const toCh = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, "0");
    return `#${toCh(rgb01[0])}${toCh(rgb01[1])}${toCh(rgb01[2])}`;
  };

  return (
    <Card className={cn("min-w-[130px] w-[160px]")}
      style={{ userSelect: "none" }}
    >
      <CardHeader className="py-2 px-3">
        <CardTitle className="text-sm">{name}</CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className="grid grid-cols-2 gap-x-2">
          <div className="flex flex-col gap-2">
            {inputs.map((pin, idx) => {
              const pid = typeof pin.id === "number" ? pin.id : idx;
              const connected = isConnected(pid);
              const val = Array.isArray(pin.value) ? (pin.value as number[]) : undefined;
              const nodeType = data?.template?.type ?? data?.type ?? "";
              const showColor = !connected && nodeType === "color" && pin.name === "in" && Array.isArray(val) && val.length >= 3;
              return (
                <div key={`in-${pid}`} className="relative flex flex-col gap-1 min-h-[24px]">
                  <Handle id={`in-${pid}`} type="target" position={Position.Left} style={{ left: -8 }} />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{pin.name}</span>
                    {connected && (
                      <span className="text-[10px] text-emerald-600">connected</span>
                    )}
                  </div>
                  {/* Inline editors for default values when not connected */}
                  {!connected && Array.isArray(val) && (
                    <div className="flex items-center gap-1">
                      {showColor ? (
                        <>
                          {/* Color (RGB) */}
                          <input
                            type="color"
                            className="h-5 w-7 p-0 border-0 bg-transparent"
                            value={fmtHex([val[0] ?? 1, val[1] ?? 1, val[2] ?? 1])}
                            onChange={(e) => {
                              const [r, g, b] = parseHex(e.target.value);
                              const next: number[] = [r, g, b, val[3] ?? 1];
                              updateInputValue(pid, next);
                            }}
                            aria-label="Color"
                          />
                          {/* Alpha */}
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            className="h-6 w-12 text-[11px] px-2"
                            value={typeof val[3] === "number" ? val[3] : 1}
                            onChange={(e) => {
                              const a = Math.max(0, Math.min(1, Number(e.target.value)));
                              const next: number[] = [val[0] ?? 1, val[1] ?? 1, val[2] ?? 1, Number.isFinite(a) ? a : 1];
                              updateInputValue(pid, next);
                            }}
                            aria-label="Alpha"
                          />
                        </>
                      ) : (
                        // Generic float/floatN editor based on array length
                        <>
                          {val.slice(0, 4).map((n, i) => (
                            <Input
                              key={i}
                              type="number"
                              step="0.01"
                              className="h-6 w-12 text-[11px] px-2"
                              value={typeof n === "number" ? n : 0}
                              onChange={(e) => {
                                const next = [...val];
                                next[i] = Number(e.target.value);
                                updateInputValue(pid, next);
                              }}
                              aria-label={`v${i}`}
                            />)
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex flex-col gap-2 items-end">
            {outputs.map((pin, idx) => {
              const pid = typeof pin.id === "number" ? pin.id : idx;
              return (
                <div key={`out-${pid}`} className="relative flex items-center gap-2 min-h-[24px]">
                  <span className="text-xs text-muted-foreground">{pin.name}</span>
                  <Handle id={`out-${pid}`} type="source" position={Position.Right} style={{ right: -8 }} />
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default GraphNode;
