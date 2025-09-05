import React from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { cn } from "@/lib/utils";

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
              return (
                <div key={`in-${pid}`} className="relative flex items-center gap-2 min-h-[24px]">
                  <Handle id={`in-${pid}`} type="target" position={Position.Left} style={{ left: -8 }} />
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
