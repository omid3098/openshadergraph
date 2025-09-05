export function isCompilableGraph(graph: any): boolean {
  try {
    if (!graph || typeof graph !== "object") return false;
    if (graph.type && graph.type === "surface") return true;
    if (!graph.type && Array.isArray(graph.nodes)) return graph.nodes.some((n: any) => n?.type === "surface");
    return false;
  } catch {
    return false;
  }
}

