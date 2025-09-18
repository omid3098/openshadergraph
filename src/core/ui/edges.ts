import { addEdge, type Connection, type Edge } from "@xyflow/react";

/**
 * Adds a connection while ensuring the destination input handle only has a single edge.
 */
export function connectSingleInputEdge(edges: Edge[], connection: Connection): Edge[] {
  if (!connection.target) return edges;

  const next = edges.filter((edge) => {
    if (edge.target !== connection.target) return true;
    const existingHandle = edge.targetHandle ?? null;
    const incomingHandle = connection.targetHandle ?? null;
    return existingHandle !== incomingHandle;
  });

  return addEdge(connection, next);
}
