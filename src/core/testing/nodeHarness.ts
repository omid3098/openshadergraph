import { NodeBuilder } from "../graph/node";
import type { Graph, GraphNode, InputPin, OutputPin } from "../graph/types";
import { chooseDominantPinType, getCoreTypeInfo, normalizePinType } from "../types/pinTypes";
import { isBuiltinToken } from "../types/builtinInputs";

export type NodeHarnessOptions = {
  /** Explicit pin type overrides keyed by input id. Useful for polymorphic nodes. */
  inputTypeOverrides?: Record<number, string>;
  /** Apply property values before fixtures run. */
  propertyOverrides?: Record<string, unknown>;
  /** Append meta entries to the node under test. */
  metaOverrides?: unknown[];
  /** Custom lifecycle hooks for complex harness scenarios (textures, nested graphs, etc.). */
  fixture?: NodeHarnessFixture;
  /** When a node exposes multiple outputs, force the harness to use this id. */
  outputPinId?: number;
  /** Optional fragment output input id to wire the test node into. */
  fragmentInputId?: number;
};

export type NodeHarnessFixture = {
  beforeAutoFill?(ctx: NodeHarnessContext): void;
  afterAutoFill?(ctx: NodeHarnessContext): void;
  beforeConnect?(ctx: NodeHarnessContext): void;
  afterConnect?(ctx: NodeHarnessContext): void;
};

export type NodeHarnessBuildResult = {
  graph: Graph;
  surface: GraphNode;
  fragmentPass: GraphNode;
  fragmentOutput: GraphNode;
  node: GraphNode;
};

export interface NodeHarnessContext extends NodeHarnessBuildResult {
  builder: NodeBuilder;
  dominantType?: string;
  /** Skip the default literal filling for the given input id. */
  skipAutoFill(pinId: number): void;
  /** Prevent the harness from wiring the node to fragment output automatically. */
  skipAutoOutput(): void;
  /** Set a property value on the harness node. Throws if the property is unknown. */
  setProperty(id: string, value: unknown): void;
  /** Update an input literal directly. */
  setInputValue(pinId: number, value: unknown): void;
  /** Connect the harness node input from another node's output. */
  connectInputFromNode(pinId: number, source: GraphNode, outputPinId?: number): void;
  /** Create a constant node and connect its output to the given input. */
  connectInputFromLiteral(pinId: number, type: string, value?: number | number[]): GraphNode;
  /** Create a node under the fragment pass (or an explicit parent). */
  createNode(type: string, parent?: GraphNode): GraphNode;
  /** Convenience to spawn a literal node (float/float2/...) without wiring it. */
  createLiteralNode(type: string, value?: number | number[]): GraphNode;
  /** Connect the harness node output to the fragment output inputs. */
  connectToFragment(outputPinId?: number, fragmentInputId?: number): void;
  /** Append a meta entry to the harness node. */
  addMeta(entry: unknown): void;
}

const LITERAL_NODE_BY_TYPE: Record<string, string> = {
  float: "float",
  float2: "float2",
  float3: "float3",
  float4: "float4",
};

const SAMPLER_SOURCE_BY_TYPE: Record<string, string> = {
  sampler2D: "texture",
  sampler3D: "texture3d",
  samplerCube: "texture_cube",
  sampler2DArray: "texture_array",
};

class NodeHarnessContextImpl implements NodeHarnessContext {
  public dominantType?: string;
  private readonly skipInputs = new Set<number>();
  private skipOutput = false;

  constructor(
    public readonly builder: NodeBuilder,
    public readonly graph: Graph,
    public readonly surface: GraphNode,
    public readonly fragmentPass: GraphNode,
    public readonly fragmentOutput: GraphNode,
    public readonly node: GraphNode
  ) {}

  skipAutoFill(pinId: number): void {
    this.skipInputs.add(pinId);
  }

  skipAutoOutput(): void {
    this.skipOutput = true;
  }

  shouldSkipAutoFill(pinId: number | undefined): boolean {
    return pinId !== undefined && this.skipInputs.has(pinId);
  }

  shouldSkipAutoOutput(): boolean {
    return this.skipOutput;
  }

  setProperty(id: string, value: unknown): void {
    const props = Array.isArray(this.node.properties) ? this.node.properties : [];
    const target = props.find((prop) => prop?.id === id);
    if (!target) {
      throw new Error(`Property '${id}' not found on node '${this.node.type}'.`);
    }
    (target as any).value = cloneValue(value);
  }

  setInputValue(pinId: number, value: unknown): void {
    const input = findInputPin(this.node, pinId);
    input.value = cloneValue(value);
  }

  connectInputFromNode(pinId: number, source: GraphNode, outputPinId = 0): void {
    this.builder.connect_nodes(source, this.node, outputPinId, pinId);
  }

  connectInputFromLiteral(pinId: number, type: string, value?: number | number[]): GraphNode {
    const literal = this.createLiteralNode(type, value);
    this.connectInputFromNode(pinId, literal);
    return literal;
  }

  createNode(type: string, parent?: GraphNode): GraphNode {
    return this.builder.create_node(type, parent ?? this.fragmentPass);
  }

  createLiteralNode(type: string, value?: number | number[]): GraphNode {
    const nodeType = LITERAL_NODE_BY_TYPE[type];
    if (!nodeType) {
      throw new Error(`No literal node registered for type '${type}'.`);
    }
    const literal = this.createNode(nodeType);
    const literalInput = literal.inputs?.[0];
    if (literalInput) {
      literalInput.type = canonicalizeTypeName(type) ?? type;
      literalInput.value = cloneValue(value ?? literalForType(type) ?? []);
    }
    const literalOutput = literal.outputs?.[0];
    if (literalOutput) {
      literalOutput.type = canonicalizeTypeName(type) ?? type;
    }
    return literal;
  }

  connectToFragment(outputPinId = 0, fragmentInputId?: number): void {
    const output = findOutputPin(this.node, outputPinId);
    const inferredType = normalizePinType(output.type) ?? this.dominantType;
    const fragmentTargetId = fragmentInputId ?? findFragmentInputIdForType(this.fragmentOutput, inferredType);
    if (fragmentTargetId === undefined) {
      throw new Error(`Unable to resolve fragment output input for type '${inferredType ?? "unknown"}'.`);
    }
    this.builder.connect_nodes(this.node, this.fragmentOutput, output.id, fragmentTargetId);
  }

  addMeta(entry: unknown): void {
    if (!Array.isArray(this.node.meta)) {
      this.node.meta = [];
    }
    this.node.meta.push(entry);
  }
}

export function buildNodeHarness(nodeType: string, options: NodeHarnessOptions = {}): NodeHarnessBuildResult {
  const builder = new NodeBuilder("surface");
  const surface = builder.to_dict();
  const fragmentPass = builder.get_node_by_type("fragment_pass");
  if (!fragmentPass) {
    throw new Error("Surface template is missing fragment_pass child node.");
  }
  const fragmentOutput = builder.find_nested_node_by_type(fragmentPass, "fragment_output");
  if (!fragmentOutput) {
    throw new Error("Fragment pass template is missing fragment_output child node.");
  }

  const harnessNode = builder.create_node(nodeType, fragmentPass);
  const context = new NodeHarnessContextImpl(builder, surface, surface, fragmentPass, fragmentOutput, harnessNode);

  applyPropertyOverrides(context, options.propertyOverrides);
  applyMetaOverrides(context, options.metaOverrides);

  options.fixture?.beforeAutoFill?.(context);

  autoFillInputs(context, options.inputTypeOverrides);

  options.fixture?.afterAutoFill?.(context);

  options.fixture?.beforeConnect?.(context);

  if (!context.shouldSkipAutoOutput()) {
    const fragmentInputId = options.fragmentInputId;
    const outputPinId = options.outputPinId;
    context.connectToFragment(outputPinId, fragmentInputId);
  }

  options.fixture?.afterConnect?.(context);

  return {
    graph: surface,
    surface,
    fragmentPass,
    fragmentOutput,
    node: harnessNode,
  };
}

type Pin = InputPin | OutputPin;

type InputTypeOverrides = Record<number, string> | undefined;

function applyPropertyOverrides(ctx: NodeHarnessContextImpl, overrides?: Record<string, unknown>) {
  if (!overrides) return;
  for (const [key, value] of Object.entries(overrides)) {
    ctx.setProperty(key, value);
  }
}

function applyMetaOverrides(ctx: NodeHarnessContextImpl, entries?: unknown[]) {
  if (!Array.isArray(entries)) return;
  for (const entry of entries) {
    ctx.addMeta(entry);
  }
}

function autoFillInputs(ctx: NodeHarnessContextImpl, overrides: InputTypeOverrides) {
  const inputs = Array.isArray(ctx.node.inputs) ? ctx.node.inputs : [];
  const observedTypes: string[] = [];

  for (const input of inputs) {
    const pinId = typeof input.id === "number" ? input.id : undefined;
    const overrideType = pinId !== undefined ? overrides?.[pinId] : undefined;
    const selectedType = selectPinType(input, overrideType);
    if (selectedType) {
      observedTypes.push(selectedType);
    }

    if (pinId !== undefined && ctx.shouldSkipAutoFill(pinId)) continue;
    const stringValue = typeof input.value === "string" ? input.value : undefined;
    if (stringValue) {
      if (isConnectionValue(stringValue) || isBuiltinToken(stringValue)) continue;
    }

    const resolvedType = canonicalizeTypeName(selectedType ?? normalizePinType(input.type));
    if (!resolvedType) continue;
    const typeInfo = getCoreTypeInfo(resolvedType);

    if (isSamplerType(resolvedType)) {
      const providerType = SAMPLER_SOURCE_BY_TYPE[resolvedType];
      if (!providerType) continue;
      const provider = ctx.createNode(providerType);
      ctx.connectInputFromNode(pinId ?? 0, provider);
      continue;
    }

    const coerced = coerceLiteralValue(input.value, resolvedType);
    if (
      pinId !== undefined &&
      shouldUseLiteralNode(resolvedType, typeInfo) &&
      stringValue === undefined
    ) {
      const literalValue = Array.isArray(coerced) || typeof coerced === "number" ? (coerced as number | number[]) : undefined;
      ctx.connectInputFromLiteral(pinId, resolvedType, literalValue);
      continue;
    }

    if (typeof input.value === "string" && input.value.length > 0) continue;
    if (Array.isArray(input.value) && input.value.length > 0 && valueMatchesType(input.value, resolvedType)) continue;

    if (coerced !== undefined) {
      input.value = coerced;
    }
  }

  const dominant = chooseDominantPinType(observedTypes);
  ctx.dominantType = dominant;
  if (dominant) {
    applyCurrentPinTypeMeta(ctx.node, dominant);
    coerceOutputTypes(ctx.node, dominant);
  }
}

function selectPinType(pin: Pin, override?: string): string | undefined {
  if (override) {
    const canonical = canonicalizeTypeName(override);
    if (canonical) {
      pin.type = canonical;
      return canonical;
    }
  }

  const declared = pin.type;
  if (typeof declared === "string") {
    const canonical = canonicalizeTypeName(declared);
    if (canonical) {
      pin.type = canonical;
      return canonical;
    }
    return declared;
  }

  if (Array.isArray(declared) && declared.length) {
    const first = declared.find((candidate) => typeof candidate === "string") as string | undefined;
    const canonical = canonicalizeTypeName(override ?? first);
    if (canonical) {
      pin.type = canonical;
      return canonical;
    }
    if (first) {
      pin.type = first;
      return first;
    }
  }

  return canonicalizeTypeName(override);
}

function coerceOutputTypes(node: GraphNode, dominant: string): void {
  if (!Array.isArray(node.outputs)) return;
  for (const output of node.outputs) {
    if (Array.isArray(output.type)) {
      output.type = canonicalizeTypeName(dominant) ?? dominant;
    }
  }
}

function applyCurrentPinTypeMeta(node: GraphNode, type: string): void {
  if (!type) return;
  if (!Array.isArray(node.meta)) node.meta = [];
  const existing = node.meta.find(
    (entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null && "current_pintype" in entry
  );
  if (existing) {
    (existing as any).current_pintype = type;
    return;
  }
  node.meta.push({ current_pintype: type });
}

function valueMatchesType(value: number[], type: string): boolean {
  const desc = getCoreTypeInfo(type);
  if (!desc) return true;
  const expected = desc.kind === "matrix" ? desc.components * desc.components : desc.components;
  return value.length === expected;
}

function shouldUseLiteralNode(type: string, info: ReturnType<typeof getCoreTypeInfo>): boolean {
  if (!info) return false;
  if (info.kind !== "vector") return false;
  return Boolean(LITERAL_NODE_BY_TYPE[type]);
}

function coerceLiteralValue(value: unknown, type: string): unknown {
  if (value !== undefined && value !== null) {
    if (typeof value === "string") {
      if (isConnectionValue(value) || isBuiltinToken(value)) return value;
    }
    if (Array.isArray(value) && value.every((v) => typeof v === "number")) {
      const canonical = canonicalizeTypeName(type) ?? type;
      if (valueMatchesType(value, canonical)) {
        return [...value];
      }
    }
  }
  const literal = literalForType(type);
  if (literal !== undefined) {
    return literal;
  }
  return value;
}

function literalForType(type?: string): number[] | undefined {
  const canonical = canonicalizeTypeName(type ?? "");
  switch (canonical) {
    case "float":
      return [0.5];
    case "float2":
      return [0.25, 0.75];
    case "float3":
      return [0.25, 0.5, 0.75];
    case "float4":
      return [0.25, 0.5, 0.75, 1.0];
    case "matrix2":
      return [1, 0, 0, 1];
    case "matrix3":
      return [1, 0, 0, 0, 1, 0, 0, 0, 1];
    case "matrix4":
      return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    default:
      return undefined;
  }
}

export function canonicalizeTypeName(type: string | undefined): string | undefined {
  if (!type) return undefined;
  const lower = type.toLowerCase();
  switch (lower) {
    case "float":
      return "float";
    case "float2":
      return "float2";
    case "float3":
      return "float3";
    case "float4":
      return "float4";
    case "matrix2":
    case "mat2":
      return "matrix2";
    case "matrix3":
    case "mat3":
      return "matrix3";
    case "matrix4":
    case "mat4":
      return "matrix4";
    case "sampler":
    case "sampler2d":
      return "sampler2D";
    case "sampler3d":
      return "sampler3D";
    case "samplercube":
      return "samplerCube";
    case "sampler2darray":
      return "sampler2DArray";
    default:
      return type;
  }
}

function isSamplerType(type: string): boolean {
  const canonical = canonicalizeTypeName(type);
  return typeof canonical === "string" && canonical.startsWith("sampler");
}

function findFragmentInputIdForType(fragmentOutput: GraphNode, type?: string): number | undefined {
  const inputs = Array.isArray(fragmentOutput.inputs) ? fragmentOutput.inputs : [];
  if (!inputs.length) return undefined;
  const canonical = canonicalizeTypeName(type ?? "");
  if (canonical) {
    const direct = inputs.find((input) => canonicalizeTypeName(normalizePinType(input.type)) === canonical);
    if (direct) return direct.id;
    const typeInfo = getCoreTypeInfo(canonical);
    if (typeInfo?.kind === "vector") {
      const vector = inputs.find((input) => {
        const info = getCoreTypeInfo(canonicalizeTypeName(normalizePinType(input.type)) ?? "");
        return info?.kind === "vector";
      });
      if (vector) return vector.id;
    }
    if (typeInfo?.kind === "scalar") {
      const scalar = inputs.find((input) => canonicalizeTypeName(normalizePinType(input.type)) === "float");
      if (scalar) return scalar.id;
    }
  }
  const fallbackScalar = inputs.find((input) => canonicalizeTypeName(normalizePinType(input.type)) === "float");
  if (fallbackScalar) return fallbackScalar.id;
  const fallbackVector = inputs.find((input) => {
    const info = getCoreTypeInfo(canonicalizeTypeName(normalizePinType(input.type)) ?? "");
    return info?.kind === "vector";
  });
  if (fallbackVector) return fallbackVector.id;
  return inputs[0]?.id;
}

function findInputPin(node: GraphNode, pinId: number): InputPin {
  const input = node.inputs?.find((pin) => pin.id === pinId);
  if (!input) throw new Error(`Input pin '${pinId}' not found on node '${node.type}'.`);
  return input;
}

function findOutputPin(node: GraphNode, pinId: number): OutputPin {
  const output = node.outputs?.find((pin) => pin.id === pinId);
  if (!output) throw new Error(`Output pin '${pinId}' not found on node '${node.type}'.`);
  return output;
}

function cloneValue<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === "object") {
    return JSON.parse(JSON.stringify(value));
  }
  return value;
}

function isConnectionValue(value: string): boolean {
  return value.includes("../");
}
