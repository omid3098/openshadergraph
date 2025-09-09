// Convert canonical graph JSON into a basic MaterialX XML string.
// Only covers a minimal subset needed for previewing graph structure.
export function graphToMaterialX(graph: any): string {
  const lines: string[] = [];
  const name = graph?.name ?? "Graph";
  const nodes: any[] = Array.isArray(graph?.nodes) ? graph.nodes : [];
  lines.push('<?xml version="1.0"?>');
  lines.push('<materialx version="1.39">');
  lines.push(`  <nodegraph name="${name}">`);
  const nodeById: Record<string, any> = {};
  for (const n of nodes) {
    if (n && typeof n === "object" && ("id" in n)) nodeById[String(n.id)] = n;
  }
  for (const n of nodes) {
    if (!n || typeof n !== "object") continue;
    const nodeName = n.name || `${n.type}_${n.id ?? ''}`;
    lines.push(`    <node name="${nodeName}" type="${n.type}">`);
    const inputs: any[] = Array.isArray(n.inputs) ? n.inputs : [];
    for (const inp of inputs) {
      let attrs = `name="${inp.name}" type="${inp.type}"`;
      const val = inp.value;
      if (typeof val === "string" && val.startsWith("../")) {
        const [srcId, outId] = val.slice(3).split("/");
        const src = nodeById[srcId];
        if (src) {
          const srcName = src.name || `${src.type}_${src.id ?? ''}`;
          const out = (src.outputs || []).find((o: any) => String(o.id) === outId);
          const outName = out ? out.name : `out${outId}`;
          attrs += ` node="${srcName}" output="${outName}"`;
        }
      } else if (val !== undefined) {
        const v = Array.isArray(val) ? val.join(',') : String(val);
        attrs += ` value="${v}"`;
      }
      lines.push(`      <input ${attrs} />`);
    }
    const outputs: any[] = Array.isArray(n.outputs) ? n.outputs : [];
    for (const out of outputs) {
      lines.push(`      <output name="${out.name}" type="${out.type}" />`);
    }
    lines.push('    </node>');
  }
  lines.push('  </nodegraph>');
  lines.push('</materialx>');
  return lines.join("\n");
}
