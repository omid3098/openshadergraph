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

// Parse a minimal MaterialX XML document back into canonical graph JSON.
// Handles top-level shader nodes and multiple nodegraphs.
export function materialxToGraph(xml: string) {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
  const doc = parser.parse(xml);
  const root = doc?.materialx ?? {};

  const nodeByName: Record<string, any> = {};
  const outputByKey: Record<string, any> = {};
  const nodes: any[] = [];
  let id = 1;

  const toInputs = (raw: any[]) =>
    raw.map((inp: any, idx: number) => ({
      id: idx,
      name: inp.name,
      type: inp.type,
      value: inp.value,
      __node: inp.node ?? inp.nodename,
      __nodegraph: inp.nodegraph,
      __output: inp.output,
    }));

  const addNode = (tag: string, obj: any) => {
    const inputsRaw = obj.input ? (Array.isArray(obj.input) ? obj.input : [obj.input]) : [];
    const outputsRaw = obj.output ? (Array.isArray(obj.output) ? obj.output : [obj.output]) : [];
    if (outputsRaw.length === 0) outputsRaw.push({ name: "out", type: obj.type ?? tag });
    const node = {
      id: id++,
      type: obj.type ?? tag,
      name: obj.name ?? "",
      meta: [],
      nodes: [],
      inputs: toInputs(inputsRaw),
      outputs: outputsRaw.map((out: any, idx: number) => ({ id: idx, name: out.name, type: out.type })),
    };
    if (node.name) nodeByName[node.name] = node;
    nodes.push(node);
    return node;
  };

  const ngs = Array.isArray((root as any).nodegraph)
    ? (root as any).nodegraph
    : (root as any).nodegraph
      ? [(root as any).nodegraph]
      : [];
  for (const ng of ngs) {
    for (const [key, val] of Object.entries(ng)) {
      if (key === "name" || key === "output" || key === "input") continue;
      const arr = Array.isArray(val) ? val : [val];
      for (const item of arr) {
        if (item && typeof item === "object" && "name" in item) {
          addNode(item.type ?? key, item);
        }
      }
    }
    const outs = ng.output ? (Array.isArray(ng.output) ? ng.output : [ng.output]) : [];
    for (const out of outs) {
      const src = nodeByName[out.nodename];
      const srcOut = src?.outputs.find((o: any) => o.name === out.output) ?? src?.outputs?.[0];
      const outNode = {
        id: id++,
        type: "output",
        name: out.name,
        meta: [],
        nodes: [],
        inputs: [{ id: 0, name: "in", type: out.type, value: src ? `../${src.id}/${srcOut?.id ?? 0}` : undefined }],
        outputs: [],
      };
      if (src && srcOut) srcOut.value = `../${outNode.id}/0`;
      nodes.push(outNode);
      if (ng.name) outputByKey[`${ng.name}/${out.name}`] = outNode;
    }
  }

  for (const [key, val] of Object.entries(root)) {
    if (key === "nodegraph") continue;
    const arr = Array.isArray(val) ? val : [val];
    for (const item of arr) {
      if (item && typeof item === "object" && "name" in item) {
        addNode(item.type ?? key, item);
      }
    }
  }

  for (const n of nodes) {
    for (const pin of n.inputs) {
      if (pin.value) continue;
      if (pin.__node) {
        const src = nodeByName[pin.__node];
        if (src) {
          const out = src.outputs.find((o: any) => o.name === pin.__output) ?? src.outputs[0];
          pin.value = `../${src.id}/${out?.id ?? 0}`;
          if (out) out.value = `../${n.id}/${pin.id}`;
        }
      } else if (pin.__nodegraph) {
        const outNode = outputByKey[`${pin.__nodegraph}/${pin.__output}`];
        if (outNode) {
          pin.value = `../${outNode.id}/0`;
        }
      }
      delete (pin as any).__node;
      delete (pin as any).__nodegraph;
      delete (pin as any).__output;
    }
  }

  const graphName = ngs[0]?.name ?? "Graph";
  return { type: "", name: graphName, meta: [], nodes, inputs: [], outputs: [] };
}
