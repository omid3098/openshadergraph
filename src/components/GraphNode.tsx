import { useCallback } from "react";
import type { Node as RFNode, NodeProps } from "@xyflow/react";
import { Handle, Position, useNodeId, useStore } from "@xyflow/react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { cn } from "@/lib/utils";
// inputs are provided by extracted components
import ColorInput from "./inputs/ColorInput";
import NumericVectorInput from "./inputs/NumericVectorInput";
import { THEME } from "@/styles/theme";
import type { NodeProperty } from "@/core/schema/types";
import { useGraphState } from "@/core/ui/GraphStateContext";

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

export function GraphNode({ data, selected }: NodeProps<RFNode<GraphNodeData>>) {
  // Handle (pin) visual size. Doubling from default.
  const HANDLE_SIZE = 8; // px
  const HANDLE_OFFSET = -Math.ceil(HANDLE_SIZE / 2 + 8);
  const name = data?.label ?? data?.type ?? "Node";
  const inputs: Pin[] = Array.isArray(data?.template?.inputs) ? data!.template!.inputs! : [];
  const outputs: Pin[] = Array.isArray(data?.template?.outputs) ? data!.template!.outputs! : [];
  const nodeId = useNodeId();
  // Subscribe to edges so this node re-renders when connections change
  const edges = useStore((s) => s.edges);
  const { nodeUpdaterApi } = useGraphState();

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

  return (
    <Card
      className={cn("min-w-[130px] w-[160px]", selected && "border-2")}
      style={{ userSelect: "none", borderColor: selected ? THEME.selectionColor : undefined }}
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
                  {/* Mini default-value editor docked to the left of the node, similar to Unity */}
                  {!connected && Array.isArray(val) && (
                    <>
                      <div
                        className="absolute z-[2] flex items-center gap-1 px-1 py-[2px] rounded-md border bg-background/90 backdrop-blur"
                        style={{ right: "calc(100% + 15px)", transform: "scale(0.8)", transformOrigin: "right center" }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        onWheel={(e) => e.stopPropagation()}
                      >
                        {showColor ? (
                          <ColorInput value={val} disabled={false} size="mini" onCommit={(next) => updateInputValue(pid, next)} />
                        ) : (
                          <NumericVectorInput value={val} size="mini" onChange={(next) => updateInputValue(pid, next)} />
                        )}
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
                  <span className="text-xs text-muted-foreground">{pin.name}</span>
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
      </CardContent>
    </Card>
  );
}

export default GraphNode;
