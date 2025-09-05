import { useCallback, useEffect, useRef, useState } from "react";
import type { Node as RFNode, NodeProps } from "@xyflow/react";
import { Handle, Position, useNodeId, useReactFlow, useStore } from "@xyflow/react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { cn } from "@/lib/utils";
import { Input } from "./ui/input";
import { RgbaColorPicker } from "react-colorful";
import { createPortal } from "react-dom";

type Pin = {
  id?: number;
  name: string;
  type: string | string[];
  value?: number[] | string | number;
};

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

export function GraphNode({ data }: NodeProps<RFNode<GraphNodeData>>) {
  const name = data?.label ?? data?.type ?? "Node";
  const inputs: Pin[] = Array.isArray(data?.template?.inputs) ? data!.template!.inputs! : [];
  const outputs: Pin[] = Array.isArray(data?.template?.outputs) ? data!.template!.outputs! : [];
  const nodeId = useNodeId();
  const rf = useReactFlow();
  // Subscribe to edges so this node re-renders when connections change
  const edges = useStore((s) => s.edges);

  // Updater must be defined before effects that reference it
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

  // Local UI state for popover color picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [pickerColor, setPickerColor] = useState<{ r: number; g: number; b: number; a: number } | null>(null);
  const [pickerTarget, setPickerTarget] = useState<number | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const openPickerAt = useCallback((x: number, y: number, init?: { r: number; g: number; b: number; a: number }, targetPin?: number) => {
    if (init) setPickerColor(init);
    setPickerPos({ x, y });
    if (typeof targetPin === "number") setPickerTarget(targetPin);
    setPickerOpen(true);
  }, []);
  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (pickerColor && typeof pickerTarget === "number") {
          const next: number[] = [to01(pickerColor.r), to01(pickerColor.g), to01(pickerColor.b), typeof pickerColor.a === "number" ? Math.round(pickerColor.a * 100) / 100 : 1];
          // Commit on ESC
          updateInputValue(pickerTarget, next);
        }
        setPickerOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickerOpen, pickerColor, pickerTarget, updateInputValue]);

  const isConnected = useCallback(
    (pid: number) => {
      if (!nodeId) return false;
      const handleId = `in-${pid}`;
      return edges.some((e) => e.target === nodeId && e.targetHandle === handleId);
    },
    [edges, nodeId]
  );

  // RGBA helpers for 0..1 <-> 0..255 conversion
  const to255 = (v?: number) => Math.max(0, Math.min(255, Math.round((v ?? 1) * 255)));
  const to01 = (v?: number) => Math.max(0, Math.min(1, (v ?? 255) / 255));

  // no-op helper removed; rely on inline stopPropagation handlers

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
                <div key={`in-${pid}`} className="relative flex items-center gap-2 justify-between min-h-[24px] w-full">
                  <Handle id={`in-${pid}`} type="target" position={Position.Left} style={{ left: -8 }} />
                  <span className="text-xs text-muted-foreground">{pin.name}</span>
                  {/* Editors for default values when not connected; inline after the pin name */}
                  {!connected && Array.isArray(val) && (
                    <div
                      className="flex items-center gap-1 ml-auto overflow-x-auto"
                      onMouseDown={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      onWheel={(e) => e.stopPropagation()}
                    >
                      {showColor ? (
                        <>
                          {/* Color swatch; click to open RGBA picker popover */}
                          <button
                            type="button"
                            className="h-5 w-8 rounded border"
                            style={{
                              backgroundColor: pickerOpen && pickerColor
                                ? `rgba(${pickerColor.r}, ${pickerColor.g}, ${pickerColor.b}, ${pickerColor.a})`
                                : `rgba(${to255(val[0])}, ${to255(val[1])}, ${to255(val[2])}, ${typeof val[3] === "number" ? val[3] : 1})`,
                            }}
                            aria-label="Edit color"
                            onMouseDown={(e) => {
                              // Prevent node drag/selection
                              e.stopPropagation();
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = (e.target as HTMLElement).getBoundingClientRect();
                              openPickerAt(rect.left, rect.bottom + 6, {
                                r: to255(val[0]),
                                g: to255(val[1]),
                                b: to255(val[2]),
                                a: typeof val[3] === "number" ? Math.round(val[3] * 100) / 100 : 1,
                              }, pid);
                            }}
                          />
                          {pickerOpen && createPortal(
                            <div
                              role="dialog"
                              aria-modal
                              onMouseDown={(e) => e.stopPropagation()}
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              {/* Backdrop commits and closes */}
                              <div
                                className="fixed inset-0 z-[1000]"
                                style={{ background: "transparent" }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Commit selected color to graph
                                  if (pickerColor && typeof pickerTarget === "number") {
                                    const next: number[] = [to01(pickerColor.r), to01(pickerColor.g), to01(pickerColor.b), typeof pickerColor.a === "number" ? Math.round(pickerColor.a * 100) / 100 : 1];
                                    updateInputValue(pickerTarget, next);
                                  }
                                  setPickerOpen(false);
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                              />
                              {/* Picker panel */}
                              <div
                                ref={pickerRef}
                                className="fixed z-[1001] rounded-md border bg-card p-2 shadow-lg"
                                style={{ left: pickerPos.x, top: pickerPos.y }}
                                onMouseDown={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                              >
                                <RgbaColorPicker
                                  color={pickerColor ?? { r: to255(val[0]), g: to255(val[1]), b: to255(val[2]), a: typeof val[3] === "number" ? Math.round(val[3] * 100) / 100 : 1 }}
                                  onChange={(c) => {
                                    // Update only local picker color; commit on close to avoid update loops
                                    setPickerColor({ r: c.r, g: c.g, b: c.b, a: typeof c.a === "number" ? Math.round(c.a * 100) / 100 : 1 });
                                  }}
                                  style={{ width: 180, height: 180 }}
                                />
                              </div>
                            </div>,
                            document.body
                          )}
                        </>
                      ) : (
                        // Generic float/floatN editor based on array length
                        <>
                          {val.slice(0, 4).map((n, i) => (
                            <Input
                              key={i}
                              type="number"
                              step="0.01"
                              className="h-6 w-10 text-[11px] px-2 no-spinner shrink-0"
                              value={typeof n === "number" ? n : 0}
                              onMouseDown={(e) => e.stopPropagation()}
                              onPointerDown={(e) => e.stopPropagation()}
                              onWheel={(e) => e.stopPropagation()}
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
