import { createContext, useContext, type ReactNode } from "react";
import type { Node } from "@xyflow/react";
import type { Graph } from "@/core/graph/types";
import type { GraphActionMeta } from "./useGraphHistory";
import type { NodeUpdaterApi } from "./nodeUpdaters";

export type GraphStateValue = {
  nodesById: Map<string, Node>;
  nodeUpdaterApi: NodeUpdaterApi;
  graph: Graph;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  peekUndo: GraphActionMeta | null;
  peekRedo: GraphActionMeta | null;
};

const GraphStateContext = createContext<GraphStateValue | null>(null);

export function GraphStateProvider({ value, children }: { value: GraphStateValue; children: ReactNode }) {
  return <GraphStateContext.Provider value={value}>{children}</GraphStateContext.Provider>;
}

export function useGraphState(): GraphStateValue {
  const ctx = useContext(GraphStateContext);
  if (!ctx) throw new Error("useGraphState must be used within a GraphStateProvider");
  return ctx;
}
