import { useCallback, useMemo } from "react";
import type { Node as RFNode, NodeProps } from "@xyflow/react";
import { Handle, NodeResizer, Position, useNodeId, useStore } from "@xyflow/react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { cn } from "@/lib/utils";
// inputs are provided by extracted components
import ColorInput from "./inputs/ColorInput";
import NumericVectorInput from "./inputs/NumericVectorInput";
import { THEME } from "@/styles/theme";
import type { NodeProperty } from "@/core/schema/types";
import { useGraphState } from "@/core/ui/GraphStateContext";
import type { NodeAssetPayload } from "@/core/ui/nodeUpdaters";
import { PropertiesPanel } from "./PropertiesPanel";
import { CompilePanel } from "./CompilePanel";
import { GraphDataPanel } from "./GraphDataPanel";
import React from "react";
const PreviewPanel = React.lazy(() => import("./PreviewPanel").then(m => ({ default: m.PreviewPanel })));
import { AssetsPanel } from "./AssetsPanel";
import { ProbePreview } from "./ProbePreview";
import { getBuiltinDisplayLabel, isBuiltinToken } from "@/core/types/builtinInputs";
import { Paperclip, ArrowDownLeft, ArrowUpRight, SlidersHorizontal, PanelsTopLeft } from "lucide-react";
import { parseEditorSize } from "@/core/ui/nodeFactory";

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
    properties?: NodeProperty[];
  };
};

const INTERACTIVE_SELECTOR = "input, textarea, select, button, [contenteditable='true'], [data-node-interactive]";

function shouldBlockNodePointer(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest(".node-drag-handle")) return false;
  if (target.closest(".react-flow__handle")) return false;
  // allow Three.js preview to handle pointer interactions (OrbitControls)
  if (target.closest(".osg-three-preview")) return false;
  return Boolean(target.closest(INTERACTIVE_SELECTOR));
}

export function GraphNode({ data, selected }: NodeProps<RFNode<GraphNodeData>>) {
  // Handle (pin) visual size. Slightly larger for easier targeting.
  const HANDLE_SIZE = 10; // px
  const HANDLE_OFFSET = -Math.ceil(HANDLE_SIZE / 2 + 8);
  // Spacing for the inline default-value widgets shown near input pins
  // Increase the gap slightly so the widget does not cover the pin shape
  const INPUT_WIDGET_GAP_PX = 20; // was ~15px, give a little breathing room
  // Approx half width of the mini widget (for drawing the decorative line from its center)
  const INPUT_WIDGET_HALF_PX = 0;
  const nodeType = data?.template?.type ?? data?.type ?? "";
  const name = data?.label ?? nodeType ?? data?.type ?? "Node";
  const inputs: Pin[] = useMemo(() => {
    return Array.isArray(data?.template?.inputs) ? (data!.template!.inputs! as Pin[]) : [];
  }, [data]);
  const outputs: Pin[] = useMemo(() => {
    return Array.isArray(data?.template?.outputs) ? (data!.template!.outputs! as Pin[]) : [];
  }, [data]);
  const properties: NodeProperty[] = useMemo(() => {
    return Array.isArray(data?.template?.properties)
      ? ((data!.template!.properties! as unknown) as NodeProperty[])
      : [];
  }, [data]);
  const nodeId = useNodeId();
  // Subscribe to edges so this node re-renders when connections change
  const edges = useStore((s) => s.edges);
  const { nodeUpdaterApi, graph } = useGraphState();
  const meta: string[] = Array.isArray((data as any)?.template?.meta) ? (((data as any).template.meta as unknown) as string[]) : [];
  const editorPanel = meta.find((m) => typeof m === "string" && m.startsWith("editor_panel:"));
  const editorPanelKey = editorPanel ? editorPanel.split(":")[1] ?? "" : "";
  const editorWidget = meta.find((m) => typeof m === "string" && m.startsWith("editor_widget:"));
  const editorWidgetKey = editorWidget ? editorWidget.split(":")[1] ?? "" : "";
  const isProbeWidget = editorWidgetKey.toLowerCase() === "probe";
  const isEditor = !isProbeWidget && meta.includes("editor_node");
  const preferredSize = isProbeWidget ? parseEditorSize(meta) : {};
  const preferredWidth = preferredSize.width;
  const preferredHeight = preferredSize.height;
  const currentAsset = (data as any)?.asset as NodeAssetPayload | undefined;

  const hasAssetProperty = useMemo(() => {
    if (!Array.isArray(properties)) return false;
    return properties.some((p: any) => p && typeof p === "object" && p.type === "asset");
  }, [properties]);

  type NodeCategory = "editor" | "asset" | "input" | "transform" | "output";
  const category: NodeCategory = useMemo(() => {
    if (isEditor) return "editor";
    const t = nodeType.toLowerCase();
    if (t.endsWith("_output") || t === "vertex_output" || t === "fragment_output") return "output";
    if (currentAsset || hasAssetProperty) return "asset";
    const hasNoInputs = (Array.isArray(inputs) ? inputs.length : 0) === 0;
    const hasOutputs = (Array.isArray(outputs) ? outputs.length : 0) > 0;
    if (hasNoInputs && hasOutputs) return "input";
    return "transform";
  }, [isEditor, currentAsset, hasAssetProperty, inputs, outputs, nodeType]);

  const isReroute = nodeType === "reroute";
  const cardWidthClass = useMemo(() => {
    if (isProbeWidget) {
      return preferredWidth ? "" : "min-w-[220px] w-[260px]";
    }
    return "min-w-[130px] w-[160px]";
  }, [isProbeWidget, preferredWidth]);

  const headerStyle = useMemo(() => {
    const defaultCategoryColors = {
      editor: "#64748B",
      asset: "#F59E0B",
      input: "#10B981",
      transform: "#3B82F6",
      output: "#8B5CF6",
    } as Record<string, string>;
    const categoryColors = (THEME as any)?.categoryColors ?? defaultCategoryColors;
    const color = categoryColors[category] ?? categoryColors.transform;
    return { backgroundColor: color, color: "white" } as React.CSSProperties;
  }, [category]);

  function getPinTypeColor(type: string | string[] | undefined): { color: string; shape: "circle" | "square" | "diamond" } {
    const defaultPinColors = {
      scalar: "#2563EB",
      vec2: "#7C3AED",
      vec3: "#7C3AED",
      vec4: "#7C3AED",
      color: "#DB2777",
      int: "#1E3A8A",
      bool: "#0D9488",
      mat3: "#6B7280",
      mat4: "#6B7280",
      texture2D: "#EA580C",
      texture3D: "#C2410C",
      textureCube: "#EA580C",
      sampler: "#92400E",
      uv: "#7C3AED",
      normal: "#7C3AED",
      position: "#7C3AED",
    } as Record<string, string>;
    const pinColors = (THEME as any)?.pinColors ?? defaultPinColors;
    const t = Array.isArray(type) ? String(type[0] ?? "") : String(type ?? "");
    const lower = t.toLowerCase();
    const is = (needle: string) => lower.includes(needle);
    if (is("sampler2d") || is("texture2d") || lower === "sampler2d") return { color: pinColors.texture2D, shape: "square" };
    if (is("sampler3d") || is("texture3d") || lower === "sampler3d") return { color: pinColors.texture3D, shape: "square" };
    if (is("samplercube") || is("texturecube") || lower === "samplercube") return { color: pinColors.textureCube, shape: "square" };
    if (is("sampler")) return { color: pinColors.sampler, shape: "square" };
    if (lower === "bool" || is("bool")) return { color: pinColors.bool, shape: "diamond" };
    if (lower === "int" || is("int")) return { color: pinColors.int, shape: "square" };
    if (lower === "float2" || is("float2") || lower === "vec2" || is("vec2") || lower === "uv") return { color: pinColors.vec2, shape: "circle" };
    if (lower === "float3" || is("float3") || lower === "vec3" || is("vec3") || lower === "normal" || lower === "position") return { color: pinColors.vec3, shape: "circle" };
    if (lower === "float4" || is("float4") || lower === "vec4" || is("vec4") || lower === "color") return { color: pinColors.vec4, shape: "circle" };
    if (lower === "mat3" || is("mat3")) return { color: pinColors.mat3, shape: "square" };
    if (lower === "mat4" || is("mat4")) return { color: pinColors.mat4, shape: "square" };
    // default numeric scalar
    return { color: pinColors.scalar, shape: "circle" };
  }

  // Updater must be defined before effects that reference it
  const updateInputValue = useCallback(
    (pinId: number, next: number[] | string | number) => {
      if (!nodeId) return;
      const external = (data as any)?.updateInputValue as ((id: string, pinId: number, val: number[] | string | number) => void) | undefined;
      if (typeof external === "function") {
        external(nodeId, pinId, next);
        return;
      }
      nodeUpdaterApi.updateInputValue(nodeId, pinId, next);
    },
    [nodeId, data, nodeUpdaterApi]
  );

  const updatePropertyValue = useCallback(
    (propId: string, next: unknown) => {
      if (!nodeId || !propId) return;
      const external = (data as any)?.updatePropertyValue as
        | ((id: string, propId: string, val: unknown) => void)
        | undefined;
      if (typeof external === "function") {
        external(nodeId, propId, next);
        return;
      }
      nodeUpdaterApi.updatePropertyValue(nodeId, propId, next);
    },
    [nodeId, data, nodeUpdaterApi]
  );

  const updateNodeAsset = useCallback(
    (asset: NodeAssetPayload | null) => {
      if (!nodeId) return;
      const external = (data as any)?.updateNodeAsset as
        | ((id: string, asset: NodeAssetPayload | null) => void)
        | undefined;
      if (typeof external === "function") {
        external(nodeId, asset);
        return;
      }
      nodeUpdaterApi.updateNodeAsset(nodeId, asset);
    },
    [nodeId, data, nodeUpdaterApi]
  );

  // Color picker state moved into ColorInput component

  const isConnected = useCallback(
    (pid: number) => {
      if (!nodeId) return false;
      const handleId = `in-${pid}`;
      return edges.some((e) => e.target === nodeId && e.targetHandle === handleId);
    },
    [edges, nodeId]
  );

  // RGBA helpers moved into ColorInput

  // no-op helper removed; rely on inline stopPropagation handlers

  const renderEditorContent = useCallback(() => {
    const widgetKey = editorWidgetKey.toLowerCase();
    if (widgetKey === "probe") {
      if (!nodeId) return <div className="p-3 text-xs text-muted-foreground">Probe unavailable.</div>;
      return <ProbePreview nodeId={nodeId} graph={graph} className="h-full" />;
    }
    const key = editorPanelKey.toLowerCase();
    if (key === "properties") {
      return <PropertiesPanel variant="node" className="h-full overflow-auto" />;
    }
    if (key === "compile") {
      return <CompilePanel variant="node" graph={graph} className="h-full" />;
    }
    if (key === "graphdata" || key === "graph_data") {
      return <GraphDataPanel variant="node" data={graph} className="h-full" />;
    }
    if (key === "preview") {
      return (
        <React.Suspense fallback={<div className="p-3 text-xs text-muted-foreground">Loading preview…</div>}>
          <PreviewPanel
            variant="node"
            graph={graph}
            className="h-full"
            asset={currentAsset ?? null}
            getProperty={(propId: string) => {
              const props: any[] = Array.isArray((data as any)?.template?.properties)
                ? ((data as any).template.properties as any[])
                : [];
              const found = props.find((p) => p && typeof p === "object" && p.id === propId);
              return found?.value ?? found?.default;
            }}
            setProperty={(propId: string, next: unknown) => {
              if (!nodeId || !propId) return;
              updatePropertyValue(propId, next);
            }}
            setAsset={(next) => updateNodeAsset(next as any)}
          />
        </React.Suspense>
      );
    }
    if (key === "assets") {
      return <AssetsPanel variant="node" className="h-full" />;
    }
    return <div className="p-3 text-xs text-muted-foreground">Editor panel unavailable.</div>;
  }, [editorWidgetKey, editorPanelKey, graph, data, nodeId, updatePropertyValue, updateNodeAsset, currentAsset]);

  const cardRingVars = useMemo(
    () =>
      ({
        borderRadius: "inherit",
        "--tw-ring-color": selected ? "#ffffff" : "var(--border)",
        "--tw-ring-offset-color": selected ? "#000000" : "var(--card)",
      }) as React.CSSProperties & {
        "--tw-ring-color"?: string;
        "--tw-ring-offset-color"?: string;
      },
    [selected]
  );
  const cardSizeStyle = useMemo(() => {
    const style: React.CSSProperties = {};
    if (preferredWidth) {
      style.width = preferredWidth;
      style.minWidth = preferredWidth;
    }
    if (preferredHeight) {
      style.height = preferredHeight;
      style.minHeight = preferredHeight;
    }
    return style;
  }, [preferredWidth, preferredHeight]);

  const probePreviewHeight = useMemo(() => {
    if (!isProbeWidget || !preferredHeight) return undefined;
    return Math.max(72, preferredHeight - 70);
  }, [isProbeWidget, preferredHeight]);
  const ringClass = selected ? "ring-2 ring-offset-2" : "ring-1 ring-offset-0";
  const ringBaseClass = "border-0";

  if (isReroute) {
    const maxPins = Math.max(inputs.length, outputs.length, 1);
    const totalInputs = inputs.length || 1;
    const totalOutputs = outputs.length || 1;
    const baseSize = 28;
    const verticalSpacing = 18;
    const rerouteHeight = Math.max(baseSize, maxPins * verticalSpacing);
    const handleSize = 10;

    const getHandleStyle = (
      type: Pin["type"],
      index: number,
      total: number,
      side: "left" | "right"
    ): React.CSSProperties => {
      const { color, shape } = getPinTypeColor(type);
      const top = ((index + 0.5) / total) * 100;
      const transform = shape === "diamond" ? "translateY(-50%) rotate(45deg)" : "translateY(-50%)";
      const style: React.CSSProperties = {
        top: `${top}%`,
        width: handleSize,
        height: handleSize,
        backgroundColor: color,
        borderRadius: shape === "circle" ? 9999 : 2,
        transform,
        zIndex: 5,
      };
      if (side === "left") {
        style.left = -(handleSize / 2 + 3);
      } else {
        style.right = -(handleSize / 2 + 3);
      }
      return style;
    };

    return (
      <div
        data-reroute-node
        className={cn(
          "relative flex items-center justify-center rounded-md border border-border bg-card/80 node-drag-handle cursor-grab active:cursor-grabbing",
          ringClass
        )}
        style={{
          ...cardRingVars,
          width: baseSize,
          minWidth: baseSize,
          height: rerouteHeight,
          minHeight: baseSize,
          padding: 4,
        }}
        onPointerDownCapture={(event) => {
          if (shouldBlockNodePointer(event.target)) {
            event.stopPropagation();
          }
        }}
      >
        <div className="w-2.5 h-2.5 rounded-sm border border-border/70 bg-background/70" />
        {inputs.map((pin, idx) => {
          const pid = typeof pin.id === "number" ? pin.id : idx;
          return (
            <Handle
              key={`in-${pid}`}
              id={`in-${pid}`}
              type="target"
              position={Position.Left}
              style={getHandleStyle(pin.type, idx, totalInputs, "left")}
            />
          );
        })}
        {outputs.map((pin, idx) => {
          const pid = typeof pin.id === "number" ? pin.id : idx;
          return (
            <Handle
              key={`out-${pid}`}
              id={`out-${pid}`}
              type="source"
              position={Position.Right}
              style={getHandleStyle(pin.type, idx, totalOutputs, "right")}
            />
          );
        })}
      </div>
    );
  }

  if (isEditor) {
    return (
      <div className="relative w-full h-full">
        <NodeResizer
          color={THEME.selectionColor}
          isVisible={selected}
          minWidth={240}
          minHeight={200}
        />
        <Card
          className={cn("h-full flex flex-col", ringBaseClass, ringClass)}
          style={cardRingVars}
          onPointerDownCapture={(event) => {
            if (shouldBlockNodePointer(event.target)) {
              event.stopPropagation();
            }
          }}
        >
          <CardHeader
            className="py-2 px-3 node-drag-handle cursor-grab active:cursor-grabbing flex items-center"
            style={{
              ...headerStyle,
              borderTopLeftRadius: "inherit",
              borderTopRightRadius: "inherit",
            }}
          >
            <div className="flex items-center gap-2">
              <PanelsTopLeft className="h-3.5 w-3.5 text-white/90" />
              <CardTitle className="text-sm text-white">{name}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            {renderEditorContent()}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card
      className={cn(cardWidthClass, ringBaseClass, ringClass)}
      style={{ ...cardRingVars, ...cardSizeStyle }}
      onPointerDownCapture={(event) => {
        if (shouldBlockNodePointer(event.target)) {
          event.stopPropagation();
        }
      }}
    >
      <CardHeader
        className="py-2 px-3 node-drag-handle cursor-grab active:cursor-grabbing flex items-center"
        style={{
          ...headerStyle,
          borderTopLeftRadius: "inherit",
          borderTopRightRadius: "inherit",
        }}
      >
        <div className="flex items-center gap-2">
          {(() => {
            if (category === "asset") return <Paperclip className="h-3.5 w-3.5 text-white/90" />;
            if (category === "input") return <ArrowDownLeft className="h-3.5 w-3.5 text-white/90" />;
            if (category === "output") return <ArrowUpRight className="h-3.5 w-3.5 text-white/90" />;
            return <SlidersHorizontal className="h-3.5 w-3.5 text-white/90" />; // transform/default
          })()}
          <CardTitle className="text-sm text-white">{name}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className={cn("pb-3", isProbeWidget ? "px-3 flex flex-col gap-3" : "px-3")}>
        <div className={cn("gap-x-2 grid", outputs.length > 0 ? "grid-cols-2" : "grid-cols-1")}> 
          <div className="flex flex-col gap-2">
            {inputs
              .filter((pin, idx) => {
                const meta = Array.isArray((data as any)?.template?.meta) ? ((data as any).template.meta as any[]) : [];
                // Find any object meta with uiPinGroups
                const groupEntry = meta.find((m) => m && typeof m === "object" && Array.isArray((m as any).uiPinGroups));
                if (!groupEntry) return true;
                const groups: Array<{ enabledBy: string; pins: number[] }> = (groupEntry as any).uiPinGroups;
                const props: any[] = Array.isArray(data?.template?.properties) ? ((data!.template!.properties! as unknown) as any[]) : [];
                const isEnabled = (id: string) => Boolean(props.find((p) => p && p.id === id && !!p.value));
                const pid = typeof pin.id === "number" ? pin.id : idx;
                for (const g of groups) {
                  if (Array.isArray(g.pins) && g.pins.includes(pid)) {
                    return isEnabled(String(g.enabledBy));
                  }
                }
                return true;
              })
              .map((pin, idx) => {
              const pid = typeof pin.id === "number" ? pin.id : idx;
              const connected = isConnected(pid);
              const val = Array.isArray(pin.value) ? (pin.value as number[]) : undefined;
              const builtinLabel = isBuiltinToken(pin.value) ? getBuiltinDisplayLabel(pin.value) : undefined;
              const showColor = !connected && nodeType === "color" && pin.name === "in" && Array.isArray(val) && val.length >= 3;
              const showDefaultWidget = !connected && (Array.isArray(val) || typeof builtinLabel === "string");
              const { color: inColor, shape: inShape } = getPinTypeColor(pin.type);
              const inHandleStyle: React.CSSProperties = {
                left: HANDLE_OFFSET,
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                backgroundColor: inColor,
                borderRadius: inShape === "circle" ? 9999 : 2,
                zIndex: 5,
                transform: inShape === "diamond" ? "rotate(45deg)" : undefined,
              };
              return (
                <div key={`in-${pid}`} className="relative flex items-center gap-2 justify-between min-h-[24px] w-full">
                  {/* Mini default-value editor docked to the left of the node, similar to Unity */}
                  {showDefaultWidget && (
                    <>
                      <div
                        className="absolute z-[2] flex items-center gap-1 px-1 py-[2px] rounded-md border bg-background/90 backdrop-blur nodrag nowheel"
                        style={{ right: `calc(100% + ${INPUT_WIDGET_GAP_PX}px)`, transform: "scale(0.8)", transformOrigin: "right center" }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        onWheel={(e) => e.stopPropagation()}
                      >
                        {showColor ? (
                          <ColorInput value={val} disabled={false} size="mini" onCommit={(next) => updateInputValue(pid, next)} />
                        ) : Array.isArray(val) ? (
                          <NumericVectorInput value={val} size="mini" onChange={(next) => updateInputValue(pid, next)} />
                        ) : builtinLabel ? (
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{builtinLabel}</span>
                        ) : null}
                      </div>
                      {/* Decorative connector: start at widget center and extend left, under widget & pin */}
                      <div
                        className="pointer-events-none absolute top-1/2 -translate-y-1/2 z-[-1] h-px bg-border"
                        style={{ left: `${-(INPUT_WIDGET_GAP_PX + INPUT_WIDGET_HALF_PX)}px`, width: `${INPUT_WIDGET_GAP_PX + INPUT_WIDGET_HALF_PX}px` }}
                      />
                    </>
                  )}
                  <Handle
                    id={`in-${pid}`}
                    type="target"
                    position={Position.Left}
                    style={inHandleStyle}
                  />
                  <span className="text-xs text-muted-foreground break-words max-w-[120px] leading-4" title={pin.name}>{pin.name}</span>
                </div>
              );
            })}
          </div>
          <div className="flex flex-col gap-2 items-end">
            {outputs.map((pin, idx) => {
              const pid = typeof pin.id === "number" ? pin.id : idx;
              const { color: outColor, shape: outShape } = getPinTypeColor(pin.type);
              const outHandleStyle: React.CSSProperties = {
                right: HANDLE_OFFSET,
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                backgroundColor: outColor,
                borderRadius: outShape === "circle" ? 9999 : 2,
                zIndex: 5,
                transform: outShape === "diamond" ? "rotate(45deg)" : undefined,
              };
              return (
                <div key={`out-${pid}`} className="relative flex items-center gap-2 min-h-[24px]">
                  <span className="text-xs text-muted-foreground break-words max-w-[120px] leading-4" title={pin.name}>{pin.name}</span>
                  <Handle
                    id={`out-${pid}`}
                    type="source"
                    position={Position.Right}
                    style={outHandleStyle}
                  />
                </div>
              );
            })}
          </div>
        </div>
        {isProbeWidget && nodeId ? (
          <div className="mb-3">
            <div
              className="rounded-md border bg-muted/30 overflow-hidden"
              data-node-interactive
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                minHeight: probePreviewHeight ?? 180,
                height: probePreviewHeight,
              }}
            >
              <ProbePreview nodeId={nodeId} graph={graph} className="h-full" />
            </div>
          </div>
        ) : null}
        {properties.length > 0 && (
          <div className={cn(isProbeWidget ? "pt-2 border-t" : "mt-3 pt-2 border-t")}>
            <div className="flex flex-col gap-2">
              {properties.map((prop: any) => {
                if (!prop || typeof prop !== "object" || !prop.id) return null;
                const label = String(prop.label ?? prop.id);
                const value = prop?.value ?? prop?.default ?? (prop.type === "boolean" ? false : "");
                if (prop.id === "expose_name") return null;
                if (prop.type === "enum") {
                  const options: Array<{ value: string; label: string }> = Array.isArray(prop.options)
                    ? prop.options.map((opt: any) => ({ value: String(opt.value), label: String(opt.label ?? opt.value) }))
                    : [];
                  const normalizedValue = options.some((opt) => opt.value === String(value))
                    ? String(value)
                    : options[0]?.value ?? "";
                  return (
                    <div key={prop.id} className="flex flex-col gap-1">
                      <label className="text-[11px] text-muted-foreground">{label}</label>
                      <Select value={normalizedValue} onValueChange={(next) => updatePropertyValue(prop.id, next)}>
                        <SelectTrigger aria-label={label} className="h-7 px-2 text-xs">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                }
                if (prop.type === "boolean") {
                  const boolValue = Boolean(value);
                  const checkboxId = `prop-${String(prop.id)}`;
                  if (prop.id === "expose") {
                    const exposeNameProp = properties.find((p: any) => p && p.id === "expose_name");
                    const exposeNameValueRaw = exposeNameProp?.value ?? exposeNameProp?.default ?? "";
                    const exposeNameValue = typeof exposeNameValueRaw === "string" ? exposeNameValueRaw : String(exposeNameValueRaw ?? "");
                    return (
                      <div key={prop.id} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <input
                            id={checkboxId}
                            type="checkbox"
                            checked={boolValue}
                            onChange={(e) => updatePropertyValue(prop.id, e.currentTarget.checked)}
                          />
                          <label htmlFor={checkboxId} className="text-[11px] text-muted-foreground select-none">{label}</label>
                        </div>
                        {boolValue && (
                          <Input
                            value={exposeNameValue}
                            placeholder="Uniform name"
                            onChange={(event) => updatePropertyValue("expose_name", event.target.value)}
                            className="h-7 px-2 text-xs"
                          />
                        )}
                      </div>
                    );
                  }
                  return (
                    <div key={prop.id} className="flex items-center gap-2">
                      <input
                        id={checkboxId}
                        type="checkbox"
                        checked={boolValue}
                        onChange={(e) => updatePropertyValue(prop.id, e.currentTarget.checked)}
                      />
                      <label htmlFor={checkboxId} className="text-[11px] text-muted-foreground select-none">{label}</label>
                    </div>
                  );
                }
                if (prop.type === "number") {
                  const min = typeof prop.min === "number" ? prop.min : undefined;
                  const max = typeof prop.max === "number" ? prop.max : undefined;
                  const step = typeof prop.step === "number" ? prop.step : undefined;
                  return (
                    <div key={prop.id} className="flex flex-col gap-1">
                      <label className="text-[11px] text-muted-foreground">{label}</label>
                      <Input
                        type="number"
                        className="h-7 px-2 text-xs"
                        value={value ?? ""}
                        min={min}
                        max={max}
                        step={step}
                        onChange={(event) => {
                          const nextVal = event.target.value;
                          updatePropertyValue(prop.id, nextVal === "" ? undefined : Number(nextVal));
                        }}
                      />
                    </div>
                  );
                }
                if (prop.type === "asset") {
                  return (
                    <div key={prop.id} className="flex flex-col gap-1">
                      <label className="text-[11px] text-muted-foreground">{label}</label>
                      <div className="flex items-center gap-2">
                        <Input value={value ?? ""} placeholder="Drop asset here" readOnly className="h-7 px-2 text-xs" />
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => updatePropertyValue(prop.id, undefined)}>
                          Clear
                        </Button>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={prop.id} className="flex flex-col gap-1">
                    <label className="text-[11px] text-muted-foreground">{label}</label>
                    <Input value={value ?? ""} onChange={(event) => updatePropertyValue(prop.id, event.target.value)} className="h-7 px-2 text-xs" />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default GraphNode;
