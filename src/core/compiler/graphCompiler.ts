import type { Graph, GraphNode, InputPin, LanguagePack } from "../graph/types";
import { getNodeTemplate } from "../schema/registry";

function fmtNum(n: number): string {
  if (Number.isInteger(n)) return n.toFixed(1);
  // keep a reasonable precision but strip trailing zeros
  let s = n.toString();
  // normalize like Python would print repr of floats in lists (often 0.5, 0.0)
  if (!s.includes(".")) s = n.toFixed(1);
  return s;
}
function resolveTypeLiteral(value: any): string {
  if (Array.isArray(value)) {
    const parts = value.map((v) => typeof v === "number" ? fmtNum(v) : String(v));
    return parts.join(", ");
  }
  if (typeof value === "number") return fmtNum(value);
  return String(value);
}

function getUniqueNodeName(node: GraphNode): string {
  return node.type ? `${node.type}_${node.id}` : `NO_TYPE_${node.id}`;
}

export class GraphCompiler {
  constructor(private graph_data: Graph, private lang_def: LanguagePack) {}
  public result_code = "";

  private has_nodes(node: GraphNode) {
    return Array.isArray(node.nodes) && node.nodes.length > 0;
  }
  private has_code(node: GraphNode) {
    return typeof node._code === "string" && node._code.length > 0;
  }
  private get_node(parent: GraphNode, id: number | string): GraphNode | undefined {
    const n = Number(id);
    return parent.nodes.find((x) => x.id === n);
  }
  private get_template(node: GraphNode): string {
    const node_type = node.type;
    const tmpl = this.lang_def.nodes?.[node_type]?.template;
    if (!tmpl) throw new Error(`No template found for node type "${node_type}" in language definition.`);
    return tmpl;
  }

  private convert_type(value: string, from_type?: any, to_type?: any): string {
    const order: Record<string, number> = { float: 1, float2: 2, float3: 3, float4: 4 };
    const normalize = (t: any): string | undefined => {
      if (Array.isArray(t)) return t[0];
      if (typeof t === "string") return t;
      return undefined;
    };
    const f = normalize(from_type);
    const t = normalize(to_type);
    if (!f || !t || f === t) return value;
    if (order[f] && order[t]) {
      const fn = order[f];
      const tn = order[t];
      if (fn > tn) {
        const swz: Record<number, string> = { 1: "x", 2: "xy", 3: "xyz", 4: "xyzw" };
        let swizzle = swz[tn];
        if (fn === 4 && tn === 3) swizzle = "rgb";
        if (fn === 4 && tn === 2) swizzle = "rg";
        return `${value}.${swizzle}`;
      }
      if (fn < tn) {
        return `vec${tn}(${value})`;
      }
    }
    return value;
  }

  private resolve_ref(node: GraphNode, input: InputPin) {
    const path = String(input.value).split("/");
    let ref_node: GraphNode = node;
    for (const p of path) {
      if (p === "..") ref_node = ref_node.parent!;
    }
    const target = this.get_node(ref_node, path[path.length - 2]);
    if (!target) throw new Error(`Cannot resolve ref node from ${input.value}`);
    this.process_node(target);
    const output_id = Number(path[path.length - 1]);
    const output_pin = target.outputs.find((o) => o.id === output_id)!;
    if (Array.isArray(output_pin.type)) {
      (input as any)._ref_type = (target as any)._resolved_type ?? output_pin.type[0];
    } else {
      (input as any)._ref_type = output_pin.type as string;
    }
    // For code substitution, use the unique node name
    (input as any).value = getUniqueNodeName(target);
  }

  private resolve_template_input(node: GraphNode, match: string, index: number) {
    const input = node.inputs[index];
    if (typeof input.value === "string" && input.value.includes("../")) {
      this.resolve_ref(node, input);
    }
    let expected_type: any = (input as any).type;
    if (Array.isArray(expected_type)) {
      expected_type = (node as any)._resolved_type ?? (input as any)._ref_type ?? expected_type[0];
    }
    if ((node as any)._resolved_type === undefined && typeof expected_type === "string") {
      (node as any)._resolved_type = expected_type;
    }
    let code = resolveTypeLiteral(input.value);
    if ((input as any)._ref_type) {
      code = this.convert_type(code, (input as any)._ref_type, expected_type);
    }
    (input as any)._code = code;
    node._code = (node._code ?? "").replace(match, code);
  }

  private remove_default_inputs(node: GraphNode) {
    const t = getNodeTemplate(node.type);
    if (!t) return;
    const defaults = new Map<string, any>(
      (t.inputs ?? []).map((i) => [i.name, i.value]) as [string, any][]
    );
    const lines = (node._code ?? "").split("\n");
    const out: string[] = [];
    for (const line of lines) {
      const stripped = line.trim();
      if (!stripped) { out.push(line); continue; }
      const prop = stripped.split("=")[0]?.trim();
      const input_pin = node.inputs.find((i) => i.name === prop);
      const defVal = defaults.get(prop);
      if (!input_pin || defVal === undefined) { out.push(line); continue; }
      const value = input_pin.value;
      if (typeof value === "string" && value.includes("../")) { out.push(line); continue; }
      // Only keep line if value differs from default
      const vv = JSON.stringify(value);
      const dd = JSON.stringify(defVal);
      if (vv !== dd) out.push(line);
    }
    node._code = out.join("\n");
  }

  private resolve_template(node: GraphNode) {
    if (node._code?.includes("{{name}}")) {
      node._code = node._code.replace("{{name}}", getUniqueNodeName(node));
    }
    // Replace indexed inputs
    const regex = /(\{\{inputs:(\d+)\}\})/g;
    const matches = [...(node._code?.matchAll(regex) ?? [])] as any[];
    for (const m of matches) {
      const match = m[1] as string;
      const input_index = Number(m[2]);
      (node as any)._resolving_input = true;
      this.resolve_template_input(node, match, input_index);
    }
    if (!node.outputs || node.outputs.length === 0) {
      this.remove_default_inputs(node);
    }
  }

  private resolve_internals(node: GraphNode): string {
    node._code = this.get_template(node);
    this.resolve_template(node);
    if (!node._code?.includes("{{internal_nodes}}")) return node._code ?? "";

    if (!this.has_nodes(node)) {
      node._code = node._code.replace("{{internal_nodes}}", "");
    } else {
      if (node._input_code) {
        node._code = node._code.replace("{{internal_nodes}}", node._input_code);
      } else {
        let internal = "";
        for (const child of node.nodes) {
          internal += `\t${child._code ?? ""}\n`;
        }
        node._code = node._code.replace("{{internal_nodes}}", internal);
      }
    }
    return node._code;
  }

  private compile_node(node: GraphNode) {
    if (this.has_code(node)) return;
    if (Array.isArray(node.meta) && node.meta.includes("exposed")) {
      node._code = "";
      return;
    }
    const code = this.resolve_internals(node);
    if (code) {
      node._code = code;
      if ((node as any)._resolving_input) {
        if (!node.parent!._input_code) node.parent!._input_code = "";
        node.parent!._input_code += `\t${code}\n`;
        delete (node as any)._resolving_input;
      } else {
        this.result_code += `${code}\n`;
      }
    }
  }

  private process_node(node: GraphNode) {
    if (this.has_code(node)) return;
    if (!this.has_nodes(node)) { this.compile_node(node); return; }
    const sorted = [...node.nodes].sort((a, b) => a.id - b.id);
    for (const child of sorted) {
      child.parent = node;
      this.process_node(child);
    }
    if (sorted.length) this.compile_node(sorted[sorted.length - 1]);
  }

  private add_meta_to_result() {
    if (!Array.isArray(this.graph_data.meta)) return;
    let meta_code = "";
    for (const m of this.graph_data.meta) {
      const tpl = this.lang_def.meta?.[m]?.template ?? "";
      meta_code += `${tpl}\n`;
    }
    this.result_code = this.result_code.replace("{{meta}}", meta_code);
  }

  private set_parents(node: GraphNode) {
    for (const child of node.nodes ?? []) {
      child.parent = node;
      this.set_parents(child);
    }
  }

  private collect_exposed_nodes(node: GraphNode, exposed: string[]) {
    if (Array.isArray(node.meta) && node.meta.includes("exposed")) {
      let code = this.lang_def.nodes[node.type].template;
      code = code.replace("{{name}}", getUniqueNodeName(node));
      for (let i = 0; i < (node.inputs?.length ?? 0); i++) {
        const val = resolveTypeLiteral(node.inputs[i].value);
        code = code.replace(`{{inputs:${i}}}`, val);
      }
      const wrapper = this.lang_def.meta?.["exposed"]?.template ?? "{{definition}}";
      exposed.push(wrapper.replace("{{definition}}", code));
    }
    for (const child of node.nodes ?? []) this.collect_exposed_nodes(child, exposed);
  }

  public compile() {
    this.set_parents(this.graph_data);
    this.result_code = this.get_template(this.graph_data);
    this.process_node(this.graph_data);
    this.add_meta_to_result();
    const exposed: string[] = [];
    this.collect_exposed_nodes(this.graph_data, exposed);
    const exposed_code = exposed.length ? exposed.join("\n") + "\n" : "";
    this.result_code = this.result_code.replace("{{exposed_nodes}}", exposed_code);
    this.result_code = this.result_code.replace("{{internal_nodes}}", "");
  }
}
