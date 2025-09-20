import { useCallback } from "react";
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
import { PreviewPanel } from "./PreviewPanel";
import { AssetsPanel } from "./AssetsPanel";
import { getBuiltinDisplayLabel, isBuiltinToken } from "@/core/types/builtinInputs";

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
  // Handle (pin) visual size. Doubling from default.
  const HANDLE_SIZE = 8; // px
  const HANDLE_OFFSET = -Math.ceil(HANDLE_SIZE / 2 + 8);
  const name = data?.label ?? data?.type ?? "Node";
  const inputs: Pin[] = Array.isArray(data?.template?.inputs) ? data!.template!.inputs! : [];
  const outputs: Pin[] = Array.isArray(data?.template?.outputs) ? data!.template!.outputs! : [];
  const properties: NodeProperty[] = Array.isArray(data?.template?.properties)
    ? ((data!.template!.properties! as unknown) as NodeProperty[])
    : [];
  const nodeId = useNodeId();
  // Subscribe to edges so this node re-renders when connections change
  const edges = useStore((s) => s.edges);
  const { nodeUpdaterApi, graph } = useGraphState();
  const meta: string[] = Array.isArray((data as any)?.template?.meta) ? (((data as any).template.meta as unknown) as string[]) : [];
  const isEditor = meta.includes("editor_node");
  const editorPanel = meta.find((m) => typeof m === "string" && m.startsWith("editor_panel:"));
  const editorPanelKey = editorPanel ? editorPanel.split(":")[1] ?? "" : "";
  const currentAsset = (data as any)?.asset as NodeAssetPayload | undefined;

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
        <PreviewPanel
          variant="node"
          graph={graph}
          className="h-full"
          asset={currentAsset ?? undefined}
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
          setAsset={(next) => updateNodeAsset(next ? { ...next } : null)}
        />
      );
    }
    if (key === "assets") {
      return <AssetsPanel variant="node" className="h-full" />;
    }
    return <div className="p-3 text-xs text-muted-foreground">Editor panel unavailable.</div>;
  }, [editorPanelKey, graph, data, nodeId, updatePropertyValue, updateNodeAsset, currentAsset]);

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
          className="h-full flex flex-col"
          style={selected ? { borderColor: THEME.selectionColor, borderWidth: 2 } : undefined}
          onPointerDownCapture={(event) => {
            if (shouldBlockNodePointer(event.target)) {
              event.stopPropagation();
            }
          }}
        >
          <CardHeader className="py-2 px-3 node-drag-handle cursor-grab active:cursor-grabbing">
            <CardTitle className="text-sm">{name}</CardTitle>
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
      className={cn("min-w-[130px] w-[160px]", selected && "border-2")}
      style={{ borderColor: selected ? THEME.selectionColor : undefined }}
      onPointerDownCapture={(event) => {
        if (shouldBlockNodePointer(event.target)) {
          event.stopPropagation();
        }
      }}
    >
      <CardHeader className="py-2 px-3 node-drag-handle cursor-grab active:cursor-grabbing">
        <CardTitle className="text-sm">{name}</CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className={cn("gap-x-2 grid", outputs.length > 0 ? "grid-cols-2" : "grid-cols-1")}> 
          <div className="flex flex-col gap-2">
            {inputs.map((pin, idx) => {
              const pid = typeof pin.id === "number" ? pin.id : idx;
              const connected = isConnected(pid);
              const val = Array.isArray(pin.value) ? (pin.value as number[]) : undefined;
              const builtinLabel = isBuiltinToken(pin.value) ? getBuiltinDisplayLabel(pin.value) : undefined;
              const nodeType = data?.template?.type ?? data?.type ?? "";
              const showColor = !connected && nodeType === "color" && pin.name === "in" && Array.isArray(val) && val.length >= 3;
              const showDefaultWidget = !connected && (Array.isArray(val) || typeof builtinLabel === "string");
              return (
                <div key={`in-${pid}`} className="relative flex items-center gap-2 justify-between min-h-[24px] w-full">
                  {/* Mini default-value editor docked to the left of the node, similar to Unity */}
                  {showDefaultWidget && (
                    <>
                      <div
                        className="absolute z-[2] flex items-center gap-1 px-1 py-[2px] rounded-md border bg-background/90 backdrop-blur nodrag nowheel"
                        style={{ right: "calc(100% + 15px)", transform: "scale(0.8)", transformOrigin: "right center" }}
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
                      {/* Visual connector from editor → pin (purely decorative) across the 10px gap */}
                      <div className="pointer-events-none absolute top-1/2 -translate-y-1/2 left-[-10px] w-[10px] h-px bg-border/60" />
                    </>
                  )}
                  <Handle
                    id={`in-${pid}`}
                    type="target"
                    position={Position.Left}
                    style={{ left: HANDLE_OFFSET, width: HANDLE_SIZE, height: HANDLE_SIZE, borderRadius: 9999 }}
                  />
                  <span className="text-xs text-muted-foreground break-words max-w-[120px] leading-4" title={pin.name}>{pin.name}</span>
                </div>
              );
            })}
          </div>
          <div className="flex flex-col gap-2 items-end">
            {outputs.map((pin, idx) => {
              const pid = typeof pin.id === "number" ? pin.id : idx;
              return (
                <div key={`out-${pid}`} className="relative flex items-center gap-2 min-h-[24px]">
                  <span className="text-xs text-muted-foreground break-words max-w-[120px] leading-4" title={pin.name}>{pin.name}</span>
                  <Handle
                    id={`out-${pid}`}
                    type="source"
                    position={Position.Right}
                    style={{ right: HANDLE_OFFSET, width: HANDLE_SIZE, height: HANDLE_SIZE, borderRadius: 9999 }}
                  />
                </div>
              );
            })}
          </div>
        </div>
        {properties.length > 0 && (
          <div className="mt-3 pt-2 border-t">
            <div className="flex flex-col gap-2">
              {properties.map((prop: any) => {
                if (!prop || typeof prop !== "object" || !prop.id) return null;
                const label = String(prop.label ?? prop.id);
                const value = prop?.value ?? prop?.default ?? (prop.type === "boolean" ? false : "");
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
                  return (
                    <div key={prop.id} className="flex flex-col gap-1">
                      <label className="text-[11px] text-muted-foreground">{label}</label>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="h-7 px-2 text-xs"
                          variant={boolValue ? "default" : "outline"}
                          onClick={() => updatePropertyValue(prop.id, !boolValue)}
                        >
                          {boolValue ? "Enabled" : "Disabled"}
                        </Button>
                      </div>
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
