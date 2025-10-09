// Canonical schema types used across core and server

import type { Graph, GraphNode, InputPin, LanguagePack, OutputPin } from "../graph/types";
import { getCoordinateSystem, swizzleDirectionRefToTarget } from "../types/coordinates";
import { getNodeTemplate } from "../schema/registry";
import {
  chooseDominantPinType,
  getCoreTypeInfo,
  guessPinTypeFromLiteral,
  normalizePinType,
  formatTypeForLanguage,
} from "../types/pinTypes";
import { getBuiltinPinType, isBuiltinToken, resolveBuiltinExpression } from "../types/builtinInputs";

// Note: Preview shading defaults are applied in the server handler using
// `withPreviewShadingDefaults` (src/core/preview/defaultShading.ts) as the
// single source of truth. Avoid duplicating or mutating that logic here.

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
  usedOutputs?: Set<number>;
  outputIdByKey?: Map<string, number>;
  outputKeyById?: Map<number, string>;
  outputExprByKey?: Map<string, string>;
};

function fmtNum(n: number): string {
  if (Number.isInteger(n)) return n.toFixed(1);
  let s = n.toString();
  if (!s.includes(".")) s = n.toFixed(1);
  return s;
}

function sanitizeExposeIdentifier(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed.length) return undefined;
  let sanitized = trimmed.replace(/[^0-9A-Za-z_]/g, "_");
  sanitized = sanitized.replace(/_{2,}/g, "_");
  if (!sanitized.length) return undefined;
  if (!/[A-Za-z_]/.test(sanitized.charAt(0))) sanitized = `_${sanitized}`;
  return sanitized;
}

function getExposeOverrideName(node: GraphNode): string | undefined {
  const props = Array.isArray(node.properties) ? node.properties : [];
  const exposedViaMeta = Array.isArray(node.meta) && node.meta.includes("exposed");
  const exposeProp = props.find((p: any) => p && p.id === "expose");
  const isExposeActive = exposeProp ? Boolean((exposeProp as any).value ?? (exposeProp as any).default) : false;
  if (!isExposeActive && !exposedViaMeta) return undefined;
  const exposeNameProp = props.find((p: any) => p && p.id === "expose_name");
  const custom = sanitizeExposeIdentifier((exposeNameProp as any)?.value ?? (exposeNameProp as any)?.default);
  return custom;
}

function getUniqueNodeName(node: GraphNode): string {
  const custom = getExposeOverrideName(node);
  if (custom) return custom;
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
  private original_graph: Graph;
  private parentMap: WeakMap<GraphNode, GraphNode | undefined> = new WeakMap();

  constructor(private graph_data: Graph, private lang_def: LanguagePack) {
    this.original_graph = graph_data;
  }

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

  private markOutputUsage(node: GraphNode, outputId: number) {
    const state = this.getNodeState(node);
    if (!state.usedOutputs) state.usedOutputs = new Set();
    state.usedOutputs.add(outputId);
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
    // Work on a deep clone to preserve caller graph immutability
    this.graph_data = JSON.parse(JSON.stringify(this.original_graph));
    this.parentMap = new WeakMap();
    this.indexNode(this.graph_data, undefined);
  }

  private indexNode(node: GraphNode, parent: GraphNode | undefined) {
    this.parentMap.set(node, parent);
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

  private getParent(node: GraphNode): GraphNode | undefined {
    return this.parentMap.get(node);
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
    const fromDesc = getCoreTypeInfo(fromName);
    const toDesc = getCoreTypeInfo(toName);
    if (!fromDesc || !toDesc) return value;

    const langTypes = this.lang_def?.types as any as Record<string, { code: string; constructor?: string; components?: number }> | undefined;
    const caps = (this.lang_def as any)?.capabilities as { allowRgbSwizzle?: boolean; vectorCtorScalarSplat?: boolean } | undefined;
    const ctor = (d: ReturnType<typeof getCoreTypeInfo>) => {
      if (!d) return "";
      const override = langTypes?.[d.name]?.code;
      if (override) return override;
      // fallback: return normalized type name if language omitted mapping
      return d.name;
    };

    if (fromDesc.kind === toDesc.kind) {
      if (fromDesc.kind === "vector") {
        const fn = fromDesc.components;
        const tn = toDesc.components;
        if (fn > tn) {
          const swz: Record<number, string> = { 1: "x", 2: "xy", 3: "xyz", 4: "xyzw" };
          let swizzle = swz[tn];
          if (caps?.allowRgbSwizzle) {
            if (fn === 4 && tn === 3) swizzle = "rgb";
            if (fn === 4 && tn === 2) swizzle = "rg";
          }
          return `${value}.${swizzle}`;
        }
        if (fn < tn) {
          // Promote lower-dimension vector to higher by appending 0.0 components
          const zeros = Array.from({ length: tn - fn }, () => "0.0").join(", ");
          const tail = zeros.length ? `, ${zeros}` : "";
          return `${ctor(toDesc)}(${value}${tail})`;
        }
        return value;
      }
      if (fromDesc.kind === "matrix") {
        if (fromDesc.components === toDesc.components) return value;
        return `${ctor(toDesc)}(${value})`;
      }
      return value;
    }

    if (fromDesc.kind === "scalar" && toDesc.kind === "vector") {
      if (caps?.vectorCtorScalarSplat) {
        const splat = Array.from({ length: toDesc.components }, () => value).join(", ");
        return `${ctor(toDesc)}(${splat})`;
      }
      return `${ctor(toDesc)}(${value})`;
    }
    if (fromDesc.kind === "vector" && toDesc.kind === "scalar") {
      return `${value}.x`;
    }
    if (fromDesc.kind === "scalar" && toDesc.kind === "matrix") {
      return `${ctor(toDesc)}(${value})`;
    }
    if (fromDesc.kind === "matrix" && toDesc.kind === "scalar") {
      return `${value}[0][0]`;
    }
    if (fromDesc.kind === "vector" && toDesc.kind === "matrix") {
      return `${ctor(toDesc)}(${value})`;
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

  private normalizeOutputKey(key: string | undefined): string {
    return typeof key === "string" ? key.trim().replace(/\s+/g, " ").toLowerCase() : "";
  }

  private getTemplateOutputs(node: GraphNode): any[] | undefined {
    try {
      const tpl = getNodeTemplate(node.type);
      if (tpl?.outputs && Array.isArray(tpl.outputs)) return tpl.outputs as any[];
    } catch (_err) {
      return undefined;
    }
    return undefined;
  }

  private getOutputKeyCandidates(
    node: GraphNode,
    output: OutputPin,
    templateOutputs?: any[]
  ): string[] {
    let templateName: string | undefined;
    if (!templateOutputs) templateOutputs = this.getTemplateOutputs(node);
    if (templateOutputs) {
      const match = templateOutputs.find((o) => o?.id === output.id);
      if (match && match.name !== undefined) templateName = String(match.name);
    }
    const name = output.name !== undefined ? String(output.name) : undefined;
    const id = typeof output.id === "number" || typeof output.id === "string" ? String(output.id) : undefined;
    const candidates = [
      name,
      templateName,
      id,
      name ? name.toLowerCase() : undefined,
      name ? name.toUpperCase() : undefined,
      templateName ? templateName.toLowerCase() : undefined,
      templateName ? templateName.toUpperCase() : undefined,
    ].filter((v): v is string => typeof v === "string" && v.length > 0);
    return candidates;
  }

  private ensureOutputKeyMaps(node: GraphNode) {
    const state = this.getNodeState(node);
    if (state.outputIdByKey && state.outputKeyById && state.outputExprByKey) return;

    const langNode = this.lang_def?.nodes?.[node.type];
    const outputs = (langNode as any)?.outputs as Record<string, string> | undefined;
    const mapByKey = new Map<string, number>();
    const mapById = new Map<number, string>();
    const exprByKey = new Map<string, string>();

    if (outputs) {
      for (const [rawKey, tpl] of Object.entries(outputs)) {
        if (typeof tpl !== "string") continue;
        const normKey = this.normalizeOutputKey(rawKey);
        exprByKey.set(normKey, tpl);
      }

      const templateOutputs = this.getTemplateOutputs(node);
      for (const output of node.outputs ?? []) {
        const candidates = this.getOutputKeyCandidates(node, output, templateOutputs);
        for (const candidate of candidates) {
          const normalized = this.normalizeOutputKey(candidate);
          if (!normalized.length) continue;
          if (!exprByKey.has(normalized)) continue;
          if (!mapById.has(output.id)) {
            mapById.set(output.id, normalized);
            mapByKey.set(normalized, output.id);
            break;
          }
        }
      }
    }

    state.outputIdByKey = mapByKey;
    state.outputKeyById = mapById;
    state.outputExprByKey = exprByKey;
  }

  private applyOutputGuards(node: GraphNode, template: string): string {
    const state = this.getNodeState(node);
    const usedOutputs = state.usedOutputs ?? new Set<number>();
    const mapByKey = state.outputIdByKey ?? new Map<string, number>();
    const pattern = /\{\{if_output:([^}]+)\}\}([\s\S]*?)\{\{\/if_output\}\}/g;
    return template.replace(pattern, (_match, rawKeys: string, block: string) => {
      const keys = String(rawKeys)
        .split("|")
        .map((k) => this.normalizeOutputKey(k))
        .filter((k) => k.length > 0);
      if (!keys.length) return "";
      let keep = false;
      for (const key of keys) {
        const outputId = mapByKey.get(key);
        if (outputId !== undefined && usedOutputs.has(outputId)) {
          keep = true;
          break;
        }
      }
      return keep ? block : "";
    });
  }

  private resolveInputReference(
    node: GraphNode,
    input: InputPin
  ): { target: GraphNode; outputId: number } | undefined {
    if (typeof input.value !== "string" || !input.value.includes("../")) return undefined;
    const path = String(input.value).split("/");
    if (path.length < 2) throw new Error(`Invalid input ref path: ${input.value}`);

    let refNode: GraphNode = node;
    for (const part of path) {
      if (part === "..") {
        const parent = this.getParent(refNode);
        if (!parent) throw new Error("Invalid parent traversal in ref path");
        refNode = parent;
      }
    }

    const nodeIdPart: string = path[path.length - 2] ?? "";
    let target = this.get_node(refNode, nodeIdPart);
    if (!target) {
      return undefined;
    }

    let outputId = Number(path[path.length - 1]);
    if (!Number.isFinite(outputId)) {
      return undefined;
    }

    if (target.type === "group") {
      const groupOut = (target.nodes ?? []).find((n) => n.type === "group_output");
      const pin = groupOut?.inputs?.find((p) => p.id === outputId);
      const v = pin?.value;
      if (typeof v === "string") {
        const m = v.match(/^\.\.\/(\d+)\/(\d+)$/);
        if (m) {
          const internalId = Number(m[1]);
          const internalOutId = Number(m[2]);
          const reroute = this.get_node(target, internalId) ?? this.get_node(this.graph_data, internalId);
          if (reroute) {
            target = reroute;
            outputId = internalOutId;
          }
        }
      }
    } else if (target.type === "group_input") {
      const parent = this.getParent(target);
      if (parent && parent.type === "group") {
        const pin = parent.inputs?.find((p) => p.id === outputId);
        const v = pin?.value;
        if (typeof v === "string") {
          const m = v.match(/^\.\.\/(\d+)\/(\d+)$/);
          if (m) {
            const extId = Number(m[1]);
            const extOutId = Number(m[2]);
            const extNode = this.get_node(parent, extId) ?? this.get_node(this.graph_data, extId);
            if (extNode) {
              target = extNode;
              outputId = extOutId;
            }
          }
        }
      }
    }

    const visitedReroutes = new Set<number>();
    const lookupNode = (current: GraphNode, id: number) => {
      const parent = this.getParent(current);
      const scope = parent ?? this.graph_data;
      return this.get_node(scope, id);
    };

    while (target && target.type === "reroute") {
      if (visitedReroutes.has(target.id)) {
        target = undefined;
        break;
      }
      visitedReroutes.add(target.id);
      const pins = Array.isArray(target.inputs) ? target.inputs : [];
      let rerouteInput = pins.find((p) => (typeof p?.id === "number" ? p.id === outputId : false));
      if (!rerouteInput && pins.length) rerouteInput = pins[0];
      if (!rerouteInput || typeof rerouteInput.value !== "string") {
        target = undefined;
        break;
      }
      const match = rerouteInput.value.match(/^\.\.\/(\d+)\/(\d+)$/);
      if (!match) {
        target = undefined;
        break;
      }
      const nextId = Number(match[1]);
      const nextOutputId = Number(match[2]);
      const nextTarget = lookupNode(target, nextId);
      if (!nextTarget) {
        target = undefined;
        break;
      }
      target = nextTarget;
      outputId = nextOutputId;
    }

    if (!target) {
      return undefined;
    }

    return { target, outputId };
  }

  private collectOutputUsage(node: GraphNode) {
    const visit = (current: GraphNode) => {
      for (const input of current.inputs ?? []) {
        if (typeof input.value !== "string" || !input.value.includes("../")) continue;
        const info = this.resolveInputReference(current, input);
        if (info) {
          this.markOutputUsage(info.target, info.outputId);
        }
      }
      for (const child of current.nodes ?? []) visit(child);
    };
    visit(node);
  }

  private get_output_expression(node: GraphNode, output: OutputPin): string {
    const name = getUniqueNodeName(node);
    const langNode = this.lang_def?.nodes?.[node.type];
    const outputs = (langNode as any)?.outputs as Record<string, string> | undefined;
    if (!outputs) return name;
    this.ensureOutputKeyMaps(node);
    const state = this.getNodeState(node);
    const normalizedKey = state.outputKeyById?.get(output.id);
    if (normalizedKey) {
      const mapped = state.outputExprByKey?.get(normalizedKey);
      if (typeof mapped === "string") {
        return mapped.replace(/\{\{name\}\}/g, name);
      }
    }

    let templateOutputs: any[] | undefined;
    try {
      const tpl = getNodeTemplate(node.type);
      if (tpl?.outputs && Array.isArray(tpl.outputs)) templateOutputs = tpl.outputs as any[];
    } catch (_err) {
      templateOutputs = undefined;
    }
    const templateName = templateOutputs?.find((o) => o?.id === output.id)?.name;
    const candidates = [
      output.name,
      templateName,
      String(output.id),
      output.name?.toLowerCase(),
      output.name?.toUpperCase(),
      templateName ? String(templateName).toLowerCase() : undefined,
      templateName ? String(templateName).toUpperCase() : undefined,
    ].filter(Boolean) as string[];
    for (const keyCandidate of candidates) {
      if (keyCandidate in outputs) {
        const tpl = outputs[keyCandidate];
        if (typeof tpl === "string") return tpl.replace(/\{\{name\}\}/g, name);
      }
    }
    return name;
  }

  private resolve_ref(node: GraphNode, input: InputPin) {
    const info = this.resolveInputReference(node, input);
    const inputState = this.getPinState(input);
    if (!info) {
      delete inputState.refType;
      delete inputState.refNodeId;
      delete inputState.refExpression;
      inputState.missingRef = true;
      return;
    }

    const { target, outputId } = info;
    this.markOutputUsage(target, outputId);

    const targetState = this.getNodeState(target);

    this.process_node(target);
    const output_pin = target.outputs.find((o) => o.id === outputId);
    if (!output_pin) {
      delete inputState.refType;
      delete inputState.refNodeId;
      delete inputState.refExpression;
      inputState.missingRef = true;
      return;
    }
    inputState.missingRef = false;
    let outputType: string | undefined;
    if (Array.isArray(output_pin.type)) {
      outputType = normalizePinType(output_pin.type);
    } else if (typeof output_pin.type === "string") {
      outputType = output_pin.type;
    }
    if (!outputType) {
      try {
        const tpl = getNodeTemplate(target.type);
        const tplOutputs = tpl?.outputs;
        if (Array.isArray(tplOutputs)) {
          const tplOut = tplOutputs.find((o: any) => o?.id === outputId);
          if (tplOut) outputType = normalizePinType(tplOut.type);
        }
      } catch (_err) {
        outputType = undefined;
      }
    }
    const resolvedType = targetState.resolvedType ?? outputType;
    if (resolvedType) inputState.refType = resolvedType; else delete inputState.refType;
    const expr = this.get_output_expression(target, output_pin);
    inputState.refNodeId = target.id;
    inputState.refExpression = expr;
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

    let templateInputs: any[] | undefined;
    try {
      const tpl = getNodeTemplate(node.type);
      if (tpl?.inputs && Array.isArray(tpl.inputs)) templateInputs = tpl.inputs as any[];
    } catch (_err) {
      templateInputs = undefined;
    }

    const candidate: string[] = [];
    const fallback: string[] = [];
    for (let idx = 0; idx < node.inputs.length; idx++) {
      const input = node.inputs[idx];
      this.ensure_input_prepared(node, input);
      const pinState = this.getPinState(input);
      const declared = normalizePinType(input.type ?? templateInputs?.[idx]?.type);
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
      let input = node.inputs?.[index];
      if (!input) {
        // If the input entry is missing entirely, fall back to the template's default
        try {
          const tpl = getNodeTemplate(node.type);
          const def = tpl?.inputs?.[index] ? (tpl as any).inputs[index].value : undefined;
          if (def !== undefined) {
            return this.formatInputLiteral(def);
          }
        } catch (_err) { /* ignore missing template */ }
        return "";
      }
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
      // Prefer resolved reference expression if available
      let code = pinState.refExpression !== undefined ? String(pinState.refExpression) : this.formatInputLiteral(input.value);
      // If still empty and template default exists, use it without mutating the graph
      if ((code === "" || code == null) && (input.value === undefined || input.value === null || (Array.isArray(input.value) && input.value.length === 0))) {
        try {
          const tpl = getNodeTemplate(node.type);
          const defVal = tpl?.inputs?.[index] ? (tpl as any).inputs[index].value : undefined;
          if (defVal !== undefined) {
            code = this.formatInputLiteral(defVal);
          }
        } catch (_err) { /* ignore missing template */ }
      }
      // If code is still empty, synthesize a zero literal appropriate for the expected type
      if (code === "" || code == null) {
        const t = expected ?? pinState.declaredType;
        const asCsv = (n: number) => Array.from({ length: n }, () => "0.0").join(", ");
        switch (t) {
          case "float":
            code = "0.0";
            break;
          case "float2":
            code = asCsv(2);
            break;
          case "float3":
            code = asCsv(3);
            break;
          case "float4":
            code = asCsv(4);
            break;
          default:
            // Fallback to scalar zero to avoid empty constructors
            code = "0.0";
            break;
        }
      }
      const fromType = pinState.refType ?? pinState.declaredType;
      if (fromType || expected) {
        code = this.convert_type(code, fromType, expected);
      }
      pinState.code = code;
      return code;
    });
  }

  private stripDefaultAssignments(node: GraphNode, code: string): string {
    // In browser fallback builds, templates may not be preloaded yet. Fail safe.
    let template: any;
    try {
      template = getNodeTemplate(node.type);
    } catch (_err) {
      template = undefined;
    }
    if (!template) return code;
    const isThree = (this.lang_def?.name ?? "").includes("ThreeJS");
    const isVertexOut = node.type === "vertex_output";
    const preserveOutputDefaults = node.type === "fragment_output";
    let outputPinPolicies: Map<number, boolean> | undefined;
    if (preserveOutputDefaults) {
      const props = Array.isArray(node.properties) ? node.properties : [];
      const getPropertyValue = (propId: string): unknown => {
        const prop = props.find((p: any) => p && (p as any).id === propId);
        if (!prop) return undefined;
        if ((prop as any).value !== undefined) return (prop as any).value;
        return (prop as any).default;
      };
      const metaEntries = Array.isArray(node.meta) ? node.meta : [];
      const pinGroups: Array<{ pins?: unknown; enabledBy?: unknown }> = [];
      for (const entry of metaEntries) {
        if (!entry || typeof entry !== "object") continue;
        const groups = (entry as any).uiPinGroups;
        if (Array.isArray(groups)) {
          for (const group of groups) {
            if (group && typeof group === "object") pinGroups.push(group as any);
          }
        }
      }
      const map = new Map<number, boolean>();
      for (const group of pinGroups) {
        const pins = Array.isArray(group.pins) ? (group.pins as any[]) : [];
        if (!pins.length) continue;
        const propId = typeof group.enabledBy === "string" ? group.enabledBy : undefined;
        const enabled = propId ? Boolean(getPropertyValue(propId)) : false;
        for (const pin of pins) {
          if (typeof pin !== "number") continue;
          const prev = map.get(pin) ?? false;
          map.set(pin, prev || enabled);
        }
      }
      outputPinPolicies = map;
    }

    const normalizeKey = (s: string) =>
      s
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

    const defaults = new Map<string, any>(
      (template.inputs ?? [])
        .filter((inp: any) => inp && typeof (inp as any).name === "string")
        .map((inp: any) => [normalizeKey(String((inp as any).name)), (inp as any).value]) as [string, any][]
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
      const propKey = String(prop ?? "");
      const propKeyNorm = normalizeKey(propKey);
      const pins = Array.isArray((node as any).inputs) ? ((node as any).inputs as any[]) : [];
      const input_pin = pins.find((inp: any) => normalizeKey(String(inp?.name ?? "")) === propKeyNorm);
      const defVal = defaults.get(propKeyNorm);
      if (!input_pin || defVal === undefined) {
        out.push(line);
        continue;
      }
      if (preserveOutputDefaults) {
        const pinId = typeof input_pin.id === "number" ? input_pin.id : undefined;
        if (pinId !== undefined) {
          const policy = outputPinPolicies?.get(pinId);
          if (policy === undefined || policy) {
            out.push(line);
            continue;
          }
        } else {
          out.push(line);
          continue;
        }
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
    let cachedUnique: string | undefined;
    const replaceNamePlaceholders = () => {
      if (!code.includes("{{name}}")) return;
      if (!cachedUnique) cachedUnique = getUniqueNodeName(node);
      code = code.replace(/\{\{name\}\}/g, cachedUnique);
    };
    replaceNamePlaceholders();

    if (code.includes("{{if_output:")) {
      this.ensureOutputKeyMaps(node);
      code = this.applyOutputGuards(node, code);
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
      const formatted = formatTypeForLanguage(resolved, this.lang_def?.name, this.lang_def?.types as any);
      if (formatted) {
        code = code.replace(/\{\{type\}\}/g, formatted);
      }
    }

    if (code.includes("{{property:")) {
      code = this.replacePropertyPlaceholders(node, code);
    }

    replaceNamePlaceholders();

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
    const langType = formatTypeForLanguage(primaryType, this.lang_def?.name, this.lang_def?.types as any);
    const literal = this.getZeroLiteralForType(primaryType);
    if (!langType || !literal) {
      return `// ${node.type} skipped due to missing input`;
    }
    const unique = getUniqueNodeName(node);
    return `${langType} ${unique} = ${literal};`;
  }

  private getZeroLiteralForType(type?: string): string | undefined {
    const t = type ?? "";
    const langType = (this.lang_def?.types as any)?.[t];
    if (langType?.zero) return langType.zero;
    switch (t) {
      case "float": return "0.0";
      case "float2": return "vec2(0.0)";
      case "float3": return "vec3(0.0)";
      case "float4": return "vec4(0.0)";
      case "matrix2": return "mat2(1.0)";
      case "matrix3": return "mat3(1.0)";
      case "matrix4": return "mat4(1.0)";
      default: return undefined;
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
    // Use a stable, local sorted view for emission order without mutating original children array
    const ordered = this.sort_children_by_dependencies(node);

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
    if (node.type === "reroute") {
      this.setNodeCode(node, "");
      return;
    }
    const props = Array.isArray(node.properties) ? node.properties : [];
    const isExposedProperty = !!props.find((p: any) => p && p.id === "expose" && !!(p as any).value);
    if (
      (Array.isArray(node.meta) && (node.meta.includes("editor_node") || node.meta.includes("exposed"))) ||
      isExposedProperty
    ) {
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
    for (const child of sorted) {
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

  // Expand scalar vector constructors if language requires scalar splat
  private normalizeScalarVectorConstructors(code: string): string {
    const expand = (src: string, n: number) => {
      const re = new RegExp(`\\bvec${n}<f32>\\(([^,)]*)\\)`, "g");
      return src.replace(re, (_m: string, s: string) => {
        const expr = (s ?? "").trim();
        // If the expression already contains a comma it's already expanded
        if (expr.includes(",")) return _m;
        // If the expression is empty, emit zero constructor
        if (expr.length === 0) return `vec${n}<f32>(0.0)`;
        // Avoid expanding when the inner expression is already a vector or swizzle
        // (e.g., "foo.xyz", "vec3<f32>(...)" or function calls). These are
        // not scalar values and should not be duplicated.
        if (expr.includes(".") || expr.includes("(") || /\bvec[234]<f32>/.test(expr)) return _m;
        const parts = Array.from({ length: n }, () => expr).join(", ");
        return `vec${n}<f32>(${parts})`;
      });
    };
    let out = code;
    out = expand(out, 2);
    out = expand(out, 3);
    out = expand(out, 4);
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
    const props = Array.isArray(node.properties) ? node.properties : [];
    const isExposedProperty = !!props.find((p: any) => p && p.id === "expose" && !!(p as any).value);
    if ((Array.isArray(node.meta) && node.meta.includes("exposed")) || isExposedProperty) {
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
    // If language mapping exists for this property, use it strictly; missing variants render nothing
    const langPropDict: any = (langNode?.properties as any)?.[propId];
    const applyName = (text: string | undefined) => {
      if (!text || !text.includes("{{name}}")) return text ?? "";
      const unique = getUniqueNodeName(node);
      return text.replace(/\{\{name\}\}/g, unique);
    };
    if (langPropDict) {
      const token = String(value ?? "");
      const variant =
        langPropDict[token] ??
        langPropDict[`${propId}_${token}`] ??
        langPropDict[`wrap_${token}`] ??
        langPropDict[`filter_${token}`] ??
        langPropDict[`space_${token}`] ??
        undefined;
      if (!variant) return result; // no emission when mapping has no variant (e.g., boolean false)
      const tpl = applyName((variant as any)?.template ?? "");
      const plc: "inline" | "meta" | undefined = (variant as any)?.placement;
      return plc ? { template: tpl, placement: plc } : { template: tpl };
    }
    if (prop?.type === "boolean") {
      return { template: value ? "true" : "false", placement: "inline" };
    }
    return { template: applyName(coercePropertyValue(value)), placement: "inline" };
  }

  public compile() {
    this.initializeGraph();
    this.collectOutputUsage(this.graph_data);
    this.process_node(this.graph_data);
    this.result_code = this.getNodeCode(this.graph_data) ?? "";
    this.add_meta_to_result();
    const exposed: string[] = [];
    this.collect_exposed_nodes(this.graph_data, exposed);
    const exposed_code = exposed.length ? exposed.join("\n") + "\n" : "";
    this.result_code = this.result_code.replace("{{exposed_nodes}}", exposed_code);
    this.result_code = this.result_code.replace("{{internal_nodes}}", "");
    this.result_code = this.hoistVaryingDeclarations(this.result_code);
    // Constructor normalization based on language capability
    const caps = (this.lang_def as any)?.capabilities as { vectorCtorScalarSplat?: boolean } | undefined;
    if (caps?.vectorCtorScalarSplat) {
      // First, collapse any redundant constructors where the inner expression
      // is already a vector/swatch (e.g., `vec3<f32>(foo.xyz)` -> `foo.xyz`)
      this.result_code = this.collapseRedundantVectorConstructors(this.result_code);
      this.result_code = this.normalizeScalarVectorConstructors(this.result_code);
      // Run collapse again to clean up any expansions that may have produced
      // repeated identical components (defensive).
      this.result_code = this.collapseRedundantVectorConstructors(this.result_code);
    }
    this.result_code = this.collapseExtraBlankLines(this.result_code);
  }

  private hoistVaryingDeclarations(code: string): string {
    const varyingRe = /^[\t ]*varying\s+[^;\n]+;\s*(?:\r?\n)?/gm;
    const declarations: string[] = [];
    const stripped = code.replace(varyingRe, (match) => {
      const decl = match.trim();
      if (decl.length && !declarations.includes(decl)) {
        declarations.push(decl.replace(/;\s*$/, ";"));
      }
      return "";
    });
    if (!declarations.length) {
      return code;
    }
    const block = `${declarations.join("\n")}\n`;
    const commentIdx = stripped.indexOf("// Varyings from default vertex shader");
    if (commentIdx !== -1) {
      const insertAfter = stripped.indexOf("\n", commentIdx);
      const pos = insertAfter === -1 ? stripped.length : insertAfter + 1;
      return `${stripped.slice(0, pos)}${block}${stripped.slice(pos)}`;
    }
    const precisionMatch = stripped.match(/precision\s+highp\s+float;\s*/);
    if (precisionMatch?.index !== undefined) {
      const pos = precisionMatch.index + precisionMatch[0].length;
      return `${stripped.slice(0, pos)}\n${block}${stripped.slice(pos)}`;
    }
    return `${block}${stripped}`;
  }

  // Collapse constructors that wrap vector-like expressions or repeated
  // identical components emitted by earlier passes. Examples handled:
  // - vec3<f32>(foo.xyz) -> foo.xyz
  // - vec3<f32>(foo.xyz, foo.xyz, foo.xyz) -> foo.xyz
  // - vec4<f32>(bar.xyzw) -> bar.xyzw
  private collapseRedundantVectorConstructors(code: string): string {
    let out = code;
    // vec3 cases: xyz or rgb swizzles
    out = out.replace(/vec3<\s*f32\s*>\(\s*([A-Za-z0-9_]+\.(?:xyz|rgb|xy|yz|xz))\s*(?:,\s*\1\s*){0,2}\)/g, (_m: string, p1: string) => {
      return p1;
    });
    // vec4 cases: xyzw or rgba swizzles
    out = out.replace(/vec4<\s*f32\s*>\(\s*([A-Za-z0-9_]+\.(?:xyzw|rgba))\s*(?:,\s*\1\s*){0,3}\)/g, (_m: string, p1: string) => {
      return p1;
    });
    // vec2 cases: xy or rg
    out = out.replace(/vec2<\s*f32\s*>\(\s*([A-Za-z0-9_]+\.(?:xy|rg))\s*(?:,\s*\1\s*){0,1}\)/g, (_m: string, p1: string) => {
      return p1;
    });
    // Collapse nested constructors like vec3<f32>(vec3<f32>(...)) -> vec3<f32>(...)
    out = out.replace(/vec(2|3|4)<\s*f32\s*>\(\s*vec\1<\s*f32\s*>\(([^)]*)\)\s*\)/g, (_m: string, _n: string, inner: string) => {
      return `vec${_n}<f32>(${inner})`;
    });
    return out;
  }

  private collapseExtraBlankLines(code: string): string {
    const lines = code.split("\n");
    const out: string[] = [];
    let blankCount = 0;
    for (const line of lines) {
      if (line.trim().length === 0) {
        blankCount += 1;
        if (blankCount > 1) continue;
      } else {
        blankCount = 0;
      }
      out.push(line);
    }
    return out.join("\n");
  }
}

// Expand vecN<f32>(s) -> vecN<f32>(s, ..., s) when language requires scalar splat
GraphCompiler.prototype["normalizeScalarVectorConstructors"] = function (this: GraphCompiler, code: string): string {
  const expand = (src: string, n: number) => {
    const re = new RegExp(`\\bvec${n}<f32>\\(([^,)]*)\\)`, "g");
    return src.replace(re, (_m: string, s: string) => {
      const expr = (s ?? "").trim();
      // If already expanded (contains comma), skip
      if (expr.includes(",")) return _m;
      // Empty -> zero constructor
      if (expr.length === 0) return `vec${n}<f32>(0.0)`;
      // Avoid expanding when inner expression is vector-like or a swizzle or a function call
      if (expr.includes(".") || expr.includes("(") || /\bvec[234]<f32>/.test(expr)) return _m;
      const parts = Array.from({ length: n }, () => expr).join(", ");
      return `vec${n}<f32>(${parts})`;
    });
  };
  let out = code;
  out = expand(out, 2);
  out = expand(out, 3);
  out = expand(out, 4);
  return out;
};
