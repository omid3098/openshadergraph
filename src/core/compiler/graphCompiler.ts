import type { Graph, GraphNode, InputPin, LanguagePack } from "../graph/types";

// A very small string-template based graph compiler. It walks the graph
// starting from the root node and emits code for each node according to the
// templates defined in the selected language pack. Only the features required
// by the tests and preview panel are implemented for now.

export class GraphCompiler {
  public result_code = "";

  private graph: Graph;
  private lang: LanguagePack;
  private nodeById = new Map<number, GraphNode>();
  private emitted = new Set<number>();
  private lines: string[] = [];

  constructor(graph: Graph, lang: LanguagePack) {
    this.graph = graph;
    this.lang = lang;
    this.collect(graph);
  }

  // Recursively collect nodes into an id->node map for quick lookups.
  private collect(node: GraphNode | undefined) {
    if (!node) return;
    if (typeof node.id === "number") this.nodeById.set(node.id, node);
    for (const c of node.nodes ?? []) this.collect(c as any);
  }

  private varName(node: GraphNode): string {
    return `n${node.id}`;
  }

  private resolveInput(pin: InputPin | undefined): string {
    if (!pin) return "0.0";
    const val = pin.value;
    if (typeof val === "string" && val.startsWith("../")) {
      const [idStr] = val.slice(3).split("/");
      const dep = this.nodeById.get(Number(idStr));
      if (dep) {
        this.compileNode(dep);
        return this.varName(dep);
      }
      return "0.0";
    }
    if (Array.isArray(val)) return val.join(",");
    if (val !== undefined) return String(val);
    return "0.0";
  }

  private compileNode(node: GraphNode) {
    if (this.emitted.has(node.id)) return;
    // Compile dependencies first
    for (const pin of node.inputs ?? []) {
      if (typeof pin.value === "string" && pin.value.startsWith("../")) {
        const [idStr] = pin.value.slice(3).split("/");
        const dep = this.nodeById.get(Number(idStr));
        if (dep) this.compileNode(dep);
      }
    }

    const tmpl = this.lang.nodes?.[node.type]?.template;
    if (!tmpl) throw new Error(`No template for node type '${node.type}'`);

    const varName = this.varName(node);
    let code = tmpl.replace(/{{name}}/g, varName);
    code = code.replace(/{{inputs:(\d+)}}/g, (_m, idxStr) => {
      const idx = Number(idxStr);
      const pin = node.inputs?.find((p) => p.id === idx);
      return this.resolveInput(pin);
    });

    node._code = code;
    this.emitted.add(node.id);
    this.lines.push(code);
  }

  public compile() {
    this.lines = [];
    for (const child of this.graph.nodes ?? []) this.compileNode(child as any);

    const metaLines = (this.graph.meta ?? [])
      .map((m) => this.lang.meta?.[m]?.template ?? "")
      .filter(Boolean)
      .join("\n");

    const tmpl = this.lang.nodes?.[this.graph.type]?.template;
    if (!tmpl) throw new Error(`No template for node type '${this.graph.type}'`);

    this.result_code = tmpl
      .replace(/{{meta}}/g, metaLines)
      .replace(/{{exposed_nodes}}/g, "")
      .replace(/{{internal_nodes}}/g, this.lines.join("\n"));
  }
}

