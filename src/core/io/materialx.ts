import { XMLParser } from "fast-xml-parser";

// Convert canonical graph JSON into a basic MaterialX XML string.
// Only covers a minimal subset needed for previewing graph structure.
export function graphToMaterialX(graph: any): string {
  const lines: string[] = [];
  const name = graph?.name ?? "Graph";
  const gather: any[] = [];
  const walk = (n: any) => {
    if (!n || typeof n !== "object") return;
    gather.push(n);
    for (const c of Array.isArray(n.nodes) ? n.nodes : []) walk(c);
  };
  for (const n of Array.isArray(graph?.nodes) ? graph.nodes : []) walk(n);
  lines.push('<?xml version="1.0"?>');
  lines.push('<materialx version="1.39">');
  lines.push(`  <nodegraph name="${name}">`);
  const nodeById: Record<string, any> = {};
  for (const n of gather) {
    if (n && typeof n === "object" && ("id" in n)) nodeById[String(n.id)] = n;
  }
  for (const n of gather) {
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

// Parse a minimal MaterialX XML nodegraph back into canonical graph JSON.
// Only supports the subset emitted by graphToMaterialX.
export function materialxToGraph(xml: string) {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
  const doc = parser.parse(xml);
  const ng = doc?.materialx?.nodegraph;
  const graphName = ng?.name ?? "Graph";
  const rawNodes = ng?.node ? (Array.isArray(ng.node) ? ng.node : [ng.node]) : [];
  const nodeByName: Record<string, any> = {};
  const nodes: any[] = [];
  let id = 1;
  for (const rn of rawNodes) {
    const inputsRaw = rn.input ? (Array.isArray(rn.input) ? rn.input : [rn.input]) : [];
    const outputsRaw = rn.output ? (Array.isArray(rn.output) ? rn.output : [rn.output]) : [];
    const node = {
      id: id++,
      type: rn.type ?? "",
      name: rn.name ?? "",
      meta: [],
      nodes: [],
      inputs: inputsRaw.map((inp: any, idx: number) => ({
        id: idx,
        name: inp.name,
        type: inp.type,
        value: inp.value,
        __node: inp.node,
        __output: inp.output,
      })),
      outputs: outputsRaw.map((out: any, idx: number) => ({ id: idx, name: out.name, type: out.type })),
    };
    nodeByName[node.name] = node;
    nodes.push(node);
  }
  for (const n of nodes) {
    for (const pin of n.inputs) {
      if (pin.__node) {
        const src = nodeByName[pin.__node];
        if (src) {
          const out = src.outputs.find((o: any) => o.name === pin.__output) ?? src.outputs[0];
          const outId = out?.id ?? 0;
          pin.value = `../${src.id}/${outId}`;
          if (out) {
            out.value = `../${n.id}/${pin.id}`;
          }
        }
      }
      delete (pin as any).__node;
      delete (pin as any).__output;
    }
  }
  return { type: "", name: graphName, meta: [], nodes, inputs: [], outputs: [] };
}
