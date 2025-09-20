import type { Graph, GraphNode, InputPin, LanguagePack, OutputPin } from "../graph/types";
import { getCoordinateSystem, swizzleDirectionRefToTarget } from "../types/coordinates";
import { getNodeTemplate } from "../schema/registry";
import {
  chooseDominantPinType,
  formatTypeForGLSL,
  getPinTypeDescriptor,
  guessPinTypeFromLiteral,
  normalizePinType,
} from "../types/pinTypes";
import { getBuiltinPinType, isBuiltinToken, resolveBuiltinExpression } from "../types/builtinInputs";

type PinState = {
  prepared?: boolean;
  refType?: string;
  declaredType?: string;
  expectedType?: string;
  code?: string;
  refNodeId?: number;
  refExpression?: string;
  missingRef?: boolean;
};

type NodeState = {
  code?: string;
  resolvedType?: string;
  allowResolvedType?: boolean;
};

function fmtNum(n: number): string {
  if (Number.isInteger(n)) return n.toFixed(1);
  let s = n.toString();
  if (!s.includes(".")) s = n.toFixed(1);
  return s;
}

function getUniqueNodeName(node: GraphNode): string {
  return node.type ? `${node.type}_${node.id}` : `NO_TYPE_${node.id}`;
}

function coercePropertyValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map((v) => coercePropertyValue(v)).join(", ");
  if (typeof value === "number") return fmtNum(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

export class GraphCompiler {
  constructor(private graph_data: Graph, private lang_def: LanguagePack) {}

  public result_code = "";

  private pinState: WeakMap<InputPin, PinState> = new WeakMap();
  private nodeState: WeakMap<GraphNode, NodeState> = new WeakMap();
  private nodeIndex = new Map<number, GraphNode>();

  private has_nodes(node: GraphNode) {
    return Array.isArray(node.nodes) && node.nodes.length > 0;
  }

  private has_code(node: GraphNode) {
    const state = this.nodeState.get(node);
    return typeof state?.code === "string" && state.code.length > 0;
  }

  private getNodeState(node: GraphNode): NodeState {
    let state = this.nodeState.get(node);
    if (!state) {
      state = {};
      this.nodeState.set(node, state);
    }
    return state;
  }

  private getPinState(pin: InputPin): PinState {
    let state = this.pinState.get(pin);
    if (!state) {
      state = {};
      this.pinState.set(pin, state);
    }
    return state;
  }

  private setNodeCode(node: GraphNode, code: string) {
    this.getNodeState(node).code = code;
  }

  private getNodeCode(node: GraphNode): string {
    return this.getNodeState(node).code ?? "";
  }

  private initializeGraph() {
    this.pinState = new WeakMap();
    this.nodeState = new WeakMap();
    this.nodeIndex.clear();
    this.indexNode(this.graph_data, undefined);
  }

  private indexNode(node: GraphNode, parent: GraphNode | undefined) {
    if (parent !== undefined) (node as any).parent = parent;
    else if ("parent" in node) delete (node as any).parent;
    this.nodeIndex.set(node.id, node);
    for (const child of node.nodes ?? []) {
      this.indexNode(child, node);
    }
  }

  private get_node(parent: GraphNode, id: number | string): GraphNode | undefined {
    const numericId = Number(id);
    const direct = parent.nodes?.find((x) => x.id === numericId);
    if (direct) return direct;
    return this.nodeIndex.get(numericId);
  }

  private get_template(node: GraphNode): string {
    const node_type = node.type;
    const tmpl = this.lang_def.nodes?.[node_type]?.template;
    if (!tmpl) throw new Error(`No template found for node type "${node_type}" in language definition.`);
    return tmpl;
  }

  private cloneTemplateInputDefault(node: GraphNode, input: InputPin): any {
    const template = getNodeTemplate(node.type);
    if (!template?.inputs?.length) return undefined;
    const idx = node.inputs?.indexOf(input) ?? -1;
    if (idx < 0) return undefined;
    const targetId = typeof input.id === "number" ? input.id : undefined;
    const tmplPin = template.inputs.find((pin, pinIdx) =>
      typeof pin?.id === "number" && targetId !== undefined ? pin.id === targetId : pinIdx === idx
    );
    if (!tmplPin) return undefined;
    if (tmplPin.value === undefined) return undefined;
    return JSON.parse(JSON.stringify(tmplPin.value));
  }

  private convert_type(value: string, from_type?: any, to_type?: any): string {
    const fromName = normalizePinType(from_type);
    const toName = normalizePinType(to_type);
    if (!fromName || !toName || fromName === toName) return value;
    const fromDesc = getPinTypeDescriptor(fromName);
    const toDesc = getPinTypeDescriptor(toName);
    if (!fromDesc || !toDesc) return value;

    if (fromDesc.kind === toDesc.kind) {
      if (fromDesc.kind === "vector") {
        const fn = fromDesc.components;
        const tn = toDesc.components;
        if (fn > tn) {
          const swz: Record<number, string> = { 1: "x", 2: "xy", 3: "xyz", 4: "xyzw" };
          let swizzle = swz[tn];
          if (fn === 4 && tn === 3) swizzle = "rgb";
          if (fn === 4 && tn === 2) swizzle = "rg";
          return `${value}.${swizzle}`;
        }
        if (fn < tn) {
          return `${toDesc.glslType}(${value})`;
        }
        return value;
      }
      if (fromDesc.kind === "matrix") {
        if (fromDesc.components === toDesc.components) return value;
        return `${toDesc.glslType}(${value})`;
      }
      return value;
    }

    if (fromDesc.kind === "scalar" && toDesc.kind === "vector") {
      return `${toDesc.glslType}(${value})`;
    }
    if (fromDesc.kind === "vector" && toDesc.kind === "scalar") {
      return `${value}.x`;
    }
    if (fromDesc.kind === "scalar" && toDesc.kind === "matrix") {
      return `${toDesc.glslType}(${value})`;
    }
    if (fromDesc.kind === "matrix" && toDesc.kind === "scalar") {
      return `${value}[0][0]`;
    }
    if (fromDesc.kind === "vector" && toDesc.kind === "matrix") {
      return `${toDesc.glslType}(${value})`;
    }
    if (fromDesc.kind === "matrix" && toDesc.kind === "vector") {
      const swz: Record<number, string> = { 1: "x", 2: "xy", 3: "xyz", 4: "xyzw" };
      const comp = Math.min(toDesc.components, 4);
      const suffix = swz[comp] ?? "x";
      return `${value}[0].${suffix}`;
    }

    return value;
  }

  private formatInputLiteral(value: any): string {
    if (isBuiltinToken(value)) {
      const langName = this.lang_def?.name ?? "";
      return resolveBuiltinExpression(value, langName);
    }
    if (Array.isArray(value)) {
      const parts = value.map((v) => (typeof v === "number" ? fmtNum(v) : String(v)));
      return parts.join(", ");
    }
    if (typeof value === "number") return fmtNum(value);
    if (value === undefined || value === null) return "";
    return String(value);
  }

  private get_output_expression(node: GraphNode, output: OutputPin): string {
    const name = getUniqueNodeName(node);
    const langNode = this.lang_def?.nodes?.[node.type];
    const outputs = (langNode as any)?.outputs as Record<string, string> | undefined;
    if (!outputs) return name;
    const candidates = [output.name, String(output.id), output.name?.toLowerCase(), output.name?.toUpperCase()].filter(Boolean) as string[];
    for (const key of candidates) {
      if (key in outputs) {
        const tpl = outputs[key];
        if (typeof tpl === "string") return tpl.replace(/\{\{name\}\}/g, name);
      }
    }
    return name;
  }

  private resolve_ref(node: GraphNode, input: InputPin) {
    const path = String(input.value).split("/");
    if (path.length < 2) throw new Error(`Invalid input ref path: ${input.value}`);
    let ref_node: GraphNode = node;
    for (const p of path) {
      if (p === "..") ref_node = ref_node.parent!;
    }
    const nodeIdPart: string = path[path.length - 2] ?? "";
    let target = this.get_node(ref_node, nodeIdPart);
    if (!target) {
      const state = this.getPinState(input);
      delete state.refType;
      delete state.refNodeId;
      delete state.refExpression;
      state.missingRef = true;
      input.value = this.cloneTemplateInputDefault(node, input);
      return;
    }
    let output_id = Number(path[path.length - 1]);

    if (target.type === "group") {
      const groupOut = (target.nodes ?? []).find((n) => n.type === "group_output");
      const pin = groupOut?.inputs?.find((p) => p.id === output_id);
      const v = pin?.value;
      if (typeof v === "string") {
        const m = v.match(/^\.\.\/(\d+)\/(\d+)$/);
        if (m) {
          const internalId = Number(m[1]);
          const internalOutId = Number(m[2]);
          const reroute = this.get_node(target, internalId) ?? this.get_node(this.graph_data, internalId);
          if (reroute) {
            target = reroute;
            output_id = internalOutId;
          }
        }
      }
    } else if (target.type === "group_input") {
      const parent = target.parent;
      if (parent && parent.type === "group") {
        const pin = parent.inputs?.find((p) => p.id === output_id);
        const v = pin?.value;
        if (typeof v === "string") {
          const m = v.match(/^\.\.\/(\d+)\/(\d+)$/);
          if (m) {
            const extId = Number(m[1]);
            const extOutId = Number(m[2]);
            const extNode = this.get_node(parent, extId) ?? this.get_node(this.graph_data, extId);
            if (extNode) {
              target = extNode;
              output_id = extOutId;
            }
          }
        }
      }
    }

    this.process_node(target);
    const output_pin = target.outputs.find((o) => o.id === output_id)!;
    const targetState = this.getNodeState(target);
    const inputState = this.getPinState(input);
    inputState.missingRef = false;
    if (Array.isArray(output_pin.type)) {
      const t = targetState.resolvedType ?? (output_pin.type[0] as string | undefined);
      if (t) inputState.refType = t; else delete inputState.refType;
    } else {
      const t = targetState.resolvedType ?? (output_pin.type as string | undefined);
      if (t) inputState.refType = t; else delete inputState.refType;
    }
    const expr = this.get_output_expression(target, output_pin);
    inputState.refNodeId = target.id;
    inputState.refExpression = expr;
    input.value = expr;
  }

  private ensure_input_prepared(node: GraphNode, input: InputPin) {
    const state = this.getPinState(input);
    if (state.prepared) return;
    if (typeof input.value === "string" && input.value.includes("../")) {
      this.resolve_ref(node, input);
    } else if (isBuiltinToken(input.value)) {
      state.refType = getBuiltinPinType(input.value);
    } else if (state.refType === undefined) {
      const inferred = guessPinTypeFromLiteral(input.value);
      if (inferred) state.refType = inferred;
    }
    state.prepared = true;
  }

  private prepare_node_inputs(node: GraphNode, unifyType: boolean) {
    if (!Array.isArray(node.inputs)) return;
    const nodeState = this.getNodeState(node);
    if (!unifyType) {
      delete nodeState.resolvedType;
      nodeState.allowResolvedType = false;
    } else {
      nodeState.allowResolvedType = true;
    }

    const candidate: string[] = [];
    const fallback: string[] = [];
    for (const input of node.inputs) {
      this.ensure_input_prepared(node, input);
      const pinState = this.getPinState(input);
      const declared = normalizePinType(input.type);
      if (pinState.refType) candidate.push(pinState.refType);
      if (declared) {
        fallback.push(declared);
        pinState.declaredType = declared;
      } else {
        delete pinState.declaredType;
      }
    }

    if (unifyType) {
      const resolved = chooseDominantPinType([...candidate, ...fallback]);
      if (resolved) nodeState.resolvedType = resolved;
    }

    for (const input of node.inputs) {
      const pinState = this.getPinState(input);
      let target: string | undefined;
      if (unifyType) {
        target = nodeState.resolvedType ?? pinState.refType ?? pinState.declaredType;
      } else {
        target = pinState.declaredType ?? pinState.refType;
      }
      if (target) pinState.expectedType = target;
    }
  }

  private replacePropertyPlaceholders(node: GraphNode, template: string): string {
    const regex = /(\{\{property:([^}]+)\}\})/g;
    const langNode = this.lang_def.nodes?.[node.type];
    let guard = 0;
    let code = template;
    while (regex.test(code) && guard++ < 10) {
      regex.lastIndex = 0;
      code = code.replace(regex, (_match, full: string, propId: string) => {
        const rendered = this.render_property(node, String(propId).trim(), langNode);
        return rendered.template ?? "";
      });
    }
    return code;
  }

  private replaceInputPlaceholders(node: GraphNode, template: string): string {
    const regex = /(\{\{inputs:(\d+)\}\})/g;
    return template.replace(regex, (_match, _full, indexStr: string) => {
      const index = Number(indexStr);
      const input = node.inputs?.[index];
      if (!input) return "";
      this.ensure_input_prepared(node, input);
      const pinState = this.getPinState(input);
      if (pinState.missingRef) {
        const fallback = this.getMissingInputLiteral(node, input, pinState);
        pinState.code = fallback;
        return fallback;
      }
      const expected = pinState.expectedType ?? this.getNodeState(node).resolvedType ?? pinState.declaredType;
      if (pinState.expectedType === undefined && expected) {
        pinState.expectedType = expected;
      }
      let code = this.formatInputLiteral(input.value);
      const fromType = pinState.refType ?? pinState.declaredType;
      if (fromType || expected) {
        code = this.convert_type(code, fromType, expected);
      }
      pinState.code = code;
      return code;
    });
  }

  private stripDefaultAssignments(node: GraphNode, code: string): string {
    const template = getNodeTemplate(node.type);
    if (!template) return code;
    const isThree = (this.lang_def?.name ?? "").includes("ThreeJS");
    const isVertexOut = node.type === "vertex_output";

    const normalizeKey = (s: string) =>
      s
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

    const defaults = new Map<string, any>(
      (template.inputs ?? [])
        .filter((i) => i && typeof (i as any).name === "string")
        .map((i) => [normalizeKey(String((i as any).name)), (i as any).value]) as [string, any][]
    );
    const lines = code.split("\n");
    const out: string[] = [];
    for (const line of lines) {
      const stripped = line.trim();
      if (!stripped) {
        out.push(line);
        continue;
      }
      const prop = stripped.split("=")[0]?.trim();
      const propKey = String(prop);
      const propKeyNorm = normalizeKey(propKey);
      const input_pin = node.inputs.find((i) => normalizeKey(String(i.name)) === propKeyNorm);
      const defVal = defaults.get(propKeyNorm);
      if (!input_pin || defVal === undefined) {
        out.push(line);
        continue;
      }
      const value = input_pin.value;
      if (typeof value === "string" && value.includes("../")) {
        out.push(line);
        continue;
      }
      if (isThree && isVertexOut) {
        if (propKey === "VERTEX" || propKey === "COLOR") {
          out.push(line);
          continue;
        }
        if (propKey === "NORMAL") {
          const vv = JSON.stringify(value);
          const dd = JSON.stringify(defVal);
          if (vv !== dd) {
            out.push(line);
          }
          continue;
        }
      }
      const vv = JSON.stringify(value);
      const dd = JSON.stringify(defVal);
      if (vv !== dd) out.push(line);
    }
    return out.join("\n");
  }

  private applyDirectionSwizzle(node: GraphNode, code: string): string {
    if (node.type !== "normal_vector" && node.type !== "view_direction") return code;
    const cs = getCoordinateSystem(this.lang_def);
    const name = getUniqueNodeName(node);
    const swizzled = swizzleDirectionRefToTarget(name, cs);
    if (swizzled === name || !code) return code;
    const lines = code.split("\n");
    if (!lines.length) return code;
    lines.push(`${name} = ${swizzled};`);
    return lines.join("\n");
  }

  private populateTemplate(node: GraphNode, template: string, options: { mutate?: boolean; stripDefaults?: boolean } = {}): string {
    let code = template;
    if (code.includes("{{name}}")) {
      const unique = getUniqueNodeName(node);
      code = code.replace(/\{\{name\}\}/g, unique);
    }

    const needsType = code.includes("{{type}}");
    this.prepare_node_inputs(node, needsType);

    const fallbackCode = this.tryRenderMissingInputFallback(node);
    if (fallbackCode !== undefined) {
      if (options.mutate) {
        this.setNodeCode(node, fallbackCode);
      }
      return fallbackCode;
    }

    if (needsType) {
      const nodeState = this.getNodeState(node);
      const resolved = nodeState.resolvedType ?? normalizePinType(node.outputs?.[0]?.type);
      const formatted = formatTypeForGLSL(resolved);
      if (formatted) {
        code = code.replace(/\{\{type\}\}/g, formatted);
      }
    }

    if (code.includes("{{property:")) {
      code = this.replacePropertyPlaceholders(node, code);
    }

    if (code.includes("{{inputs:")) {
      code = this.replaceInputPlaceholders(node, code);
    }

    if ((!node.outputs || node.outputs.length === 0) && options.stripDefaults !== false) {
      code = this.stripDefaultAssignments(node, code);
    }

    code = this.applyDirectionSwizzle(node, code);

    if (options.mutate) {
      this.setNodeCode(node, code);
    }

    return code;
  }

  private tryRenderMissingInputFallback(node: GraphNode): string | undefined {
    const inputs = node.inputs ?? [];
    if (!inputs.length) return undefined;
    const missing = inputs.some((pin) => this.getPinState(pin).missingRef);
    if (!missing) return undefined;

    if (node.type === "texture_sampler" || node.type === "texture_sampler_cube") {
      const unique = getUniqueNodeName(node);
      return `vec4 ${unique} = vec4(0.0);`;
    }

    const outputs = node.outputs ?? [];
    if (!outputs.length) return "";
    const primaryType = normalizePinType(outputs[0]?.type);
    const glslType = formatTypeForGLSL(primaryType);
    const literal = this.getZeroLiteralForType(primaryType);
    if (!glslType || !literal) {
      return `// ${node.type} skipped due to missing input`;
    }
    const unique = getUniqueNodeName(node);
    return `${glslType} ${unique} = ${literal};`;
  }

  private getZeroLiteralForType(type?: string): string | undefined {
    switch (type) {
      case "float":
        return "0.0";
      case "float2":
        return "vec2(0.0)";
      case "float3":
        return "vec3(0.0)";
      case "float4":
        return "vec4(0.0)";
      case "matrix2":
        return "mat2(1.0)";
      case "matrix3":
        return "mat3(1.0)";
      case "matrix4":
        return "mat4(1.0)";
      default:
        return undefined;
    }
  }

  private getMissingInputLiteral(node: GraphNode, input: InputPin, state: PinState): string {
    const declared = state.declaredType ?? normalizePinType(input.type);
    const literal = this.getZeroLiteralForType(declared);
    if (literal) return literal;
    // Fallback to empty literal to avoid undefined references; callers may handle node-level fallback.
    return "";
  }

  private computeReachableChildIds(node: GraphNode): Set<number> | undefined {
    const isPass = node.type === "fragment_pass" || node.type === "vertex_pass";
    if (!isPass) return undefined;

    const children = node.nodes ?? [];
    const byId = new Map<number, GraphNode>(children.map((c) => [c.id, c] as const));
    const refRe = /^\.\.\/(\d+)\/(\d+)$/;
    const producersByConsumer = new Map<number, number[]>();

    for (const child of children) {
      for (const pin of child.inputs ?? []) {
        this.ensure_input_prepared(child, pin);
        const pinState = this.getPinState(pin);
        let fromId = pinState.refNodeId;
        if (fromId === undefined && typeof pin.value === "string") {
          const m = pin.value.match(refRe);
          if (m) fromId = Number(m[1]);
        }
        if (fromId === undefined) continue;
        if (!byId.has(fromId)) continue;
        let list = producersByConsumer.get(child.id);
        if (!list) {
          list = [];
          producersByConsumer.set(child.id, list);
        }
        list.push(fromId);
      }
    }

    const sinkTypes = node.type === "vertex_pass" ? new Set(["vertex_output"]) : new Set(["fragment_output"]);
    const reachable = new Set<number>();
    const stack: number[] = [];
    for (const child of children) {
      if (sinkTypes.has(child.type)) {
        reachable.add(child.id);
        stack.push(child.id);
      }
    }

    while (stack.length) {
      const cid = stack.pop()!;
      const producers = producersByConsumer.get(cid) ?? [];
      for (const pid of producers) {
        if (!reachable.has(pid)) {
          reachable.add(pid);
          stack.push(pid);
        }
      }
    }

    for (const child of children) {
      if (child.type === "group") reachable.add(child.id);
    }

    return reachable;
  }

  private renderInternalNodes(node: GraphNode, template: string): string {
    if (!template.includes("{{internal_nodes}}")) return template;

    if (!this.has_nodes(node)) {
      const code = template.replace("{{internal_nodes}}", "");
      this.setNodeCode(node, code);
      return code;
    }

    const isPass = node.type === "fragment_pass" || node.type === "vertex_pass";
    const indent = isPass ? "\t" : "";
    const reachable = this.computeReachableChildIds(node);
    const children = node.nodes ?? [];

    const grouped: GraphNode[] = [];
    const others: GraphNode[] = [];
    if (isPass) {
      for (const child of children) {
        if (child.type === "group") grouped.push(child);
        else others.push(child);
      }
    }
    const ordered = isPass ? [...grouped, ...others] : children;

    const lines: string[] = [];
    for (const child of ordered) {
      if (reachable && !reachable.has(child.id)) continue;
      const childCode = this.getNodeCode(child);
      if (!childCode) continue;
      const childLines = childCode.split("\n");
      for (const line of childLines) {
        if (line.length === 0) {
          lines.push("");
        } else {
          lines.push(`${indent}${line}`);
        }
      }
    }

    const block = lines.length ? `${lines.join("\n")}\n` : "";
    const code = template.replace("{{internal_nodes}}", block);
    this.setNodeCode(node, code);
    return code;
  }

  private resolve_internals(node: GraphNode): string {
    if (node.type === "group_input" || node.type === "group_output") {
      this.setNodeCode(node, "");
      return "";
    }

    const baseTemplate = node.type === "group" ? "{{internal_nodes}}" : this.get_template(node);
    const hydrated = this.populateTemplate(node, baseTemplate, { mutate: true, stripDefaults: true });
    if (!hydrated.includes("{{internal_nodes}}")) {
      return hydrated;
    }

    return this.renderInternalNodes(node, hydrated);
  }

  private compile_node(node: GraphNode) {
    if (this.has_code(node)) return;
    if (Array.isArray(node.meta) && (node.meta.includes("editor_node") || node.meta.includes("exposed"))) {
      this.setNodeCode(node, "");
      return;
    }
    const code = this.resolve_internals(node);
    if (code) {
      this.setNodeCode(node, code);
    }
  }

  private process_node(node: GraphNode) {
    if (this.has_code(node)) return;
    if (!this.has_nodes(node)) {
      this.compile_node(node);
      return;
    }
    const sorted = this.sort_children_by_dependencies(node);
    node.nodes = sorted;
    for (const child of sorted) {
      child.parent = node;
      this.process_node(child);
    }
    this.compile_node(node);
  }

  private sort_children_by_dependencies(node: GraphNode): GraphNode[] {
    const children = [...(node.nodes ?? [])];
    const byId = new Map(children.map((c) => [c.id, c] as const));
    const indeg = new Map<number, number>();
    const adj = new Map<number, number[]>();
    for (const c of children) {
      indeg.set(c.id, 0);
      adj.set(c.id, []);
    }
    const refRe = /^\.\.\/(\d+)\/(\d+)$/;
    for (const c of children) {
      for (const pin of c.inputs ?? []) {
        if (typeof pin.value !== "string") continue;
        const m = pin.value.match(refRe);
        if (!m) continue;
        const fromId = Number(m[1]);
        if (!byId.has(fromId)) continue;
        adj.get(fromId)!.push(c.id);
        indeg.set(c.id, (indeg.get(c.id) ?? 0) + 1);
      }
    }
    const queue: number[] = [];
    for (const [id, d] of indeg.entries()) if (d === 0) queue.push(id);
    queue.sort((a, b) => a - b);
    const out: GraphNode[] = [];
    while (queue.length) {
      const id = queue.shift()!;
      const n = byId.get(id);
      if (n) out.push(n);
    for (const v of adj.get(id) ?? []) {
        indeg.set(v, (indeg.get(v) ?? 0) - 1);
        if ((indeg.get(v) ?? 0) === 0) {
          let i = 0;
          while (i < queue.length && queue[i]! < v) i++;
          queue.splice(i, 0, v);
        }
      }
    }
    if (out.length < children.length) {
      const seen = new Set(out.map((n) => n.id));
      const rest = children.filter((c) => !seen.has(c.id)).sort((a, b) => a.id - b.id);
      out.push(...rest);
    }
    return out;
  }

  private add_meta_to_result() {
    const allMeta = new Set<string>();
    const propertyMeta = new Set<string>();
    const walk = (n: GraphNode) => {
      if (Array.isArray(n.meta)) {
        for (const m of n.meta) if (typeof m === "string") allMeta.add(m);
      }
      const langNode = this.lang_def.nodes?.[n.type];
      if (langNode && Array.isArray(n.properties)) {
        for (const prop of n.properties) {
          if (!prop || typeof prop !== "object" || !prop.id) continue;
          const { template, placement } = this.render_property(n, String(prop.id), langNode);
          if (placement === "meta" && template) propertyMeta.add(template);
        }
      }
      for (const c of n.nodes ?? []) walk(c);
    };
    walk(this.graph_data);

    let meta_code = "";
    for (const m of allMeta) {
      if (m === "exposed") continue;
      const tpl = this.lang_def.meta?.[m]?.template ?? "";
      if (tpl) meta_code += `${tpl}\n`;
    }
    for (const tpl of propertyMeta) {
      if (!tpl) continue;
      meta_code += `${tpl}\n`;
    }
    this.result_code = this.result_code.replace("{{meta}}", meta_code);
  }

  private renderExposedDefinition(node: GraphNode): string {
    const template = this.get_template(node);
    return this.populateTemplate(node, template, { stripDefaults: false });
  }

  private collect_exposed_nodes(node: GraphNode, exposed: string[]) {
    if (Array.isArray(node.meta) && node.meta.includes("exposed")) {
      const definition = this.renderExposedDefinition(node);
      const wrapper = this.lang_def.meta?.["exposed"]?.template ?? "{{definition}}";
      exposed.push(wrapper.replace("{{definition}}", definition));
    }
    for (const child of node.nodes ?? []) this.collect_exposed_nodes(child, exposed);
  }

  private render_property(
    node: GraphNode,
    propId: string,
    langNode?: LanguagePack["nodes"][string]
  ): { template: string; placement?: "inline" | "meta" } {
    const result: { template: string; placement?: "inline" | "meta" } = { template: "" };
    const props = Array.isArray(node.properties) ? node.properties : [];
    let prop = props.find((p: any) => p?.id === propId);
    let value = prop?.value ?? prop?.default;
    if (!prop && propId.startsWith("conversion_")) {
      const base = props.find((p: any) => p?.id === "conversion");
      if (base) {
        value = base?.value ?? base?.default;
      }
    }
    if (prop?.type === "enum") {
      const options: any[] = Array.isArray(prop.options) ? prop.options : [];
      const option = options.find((o) => o?.value === value) ?? options[0];
      const token = option?.langKey ?? option?.value ?? value;
      if (token && langNode?.properties?.[propId]?.[String(token)]) {
        const variant = langNode.properties[propId][String(token)];
        const tpl = (variant as any)?.template ?? "";
        const plc: "inline" | "meta" | undefined = (variant as any)?.placement;
        return plc ? { template: tpl, placement: plc } : { template: tpl };
      }
      return result;
    }
    if (!prop && langNode?.properties?.[propId]) {
      const token = String(value ?? "");
      const variant = (langNode.properties as any)[propId]?.[token];
      if (variant) {
        const tpl = (variant as any)?.template ?? "";
        const plc: "inline" | "meta" | undefined = (variant as any)?.placement;
        return plc ? { template: tpl, placement: plc } : { template: tpl };
      }
    }
    if (prop?.type === "boolean") {
      return { template: value ? "true" : "false", placement: "inline" };
    }
    return { template: coercePropertyValue(value), placement: "inline" };
  }

  public compile() {
    this.initializeGraph();
    this.process_node(this.graph_data);
    this.result_code = this.getNodeCode(this.graph_data) ?? "";
    this.add_meta_to_result();
    const exposed: string[] = [];
    this.collect_exposed_nodes(this.graph_data, exposed);
    const exposed_code = exposed.length ? exposed.join("\n") + "\n" : "";
    this.result_code = this.result_code.replace("{{exposed_nodes}}", exposed_code);
    this.result_code = this.result_code.replace("{{internal_nodes}}", "");
  }
}
