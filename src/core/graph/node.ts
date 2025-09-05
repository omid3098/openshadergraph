import type { Graph, GraphNode, InputPin, OutputPin } from "./types";
import { getNodeTemplate } from "../schema/registry";

export class NodeBuilder {
  private last_id = -1;
  public graph_data: Graph;

  constructor(template: string) {
    this.graph_data = this._create_node(undefined as any, template) as Graph;
    // Initialize child nodes from template if any
    const nodes = [...(this.graph_data.nodes ?? [])];
    this.graph_data.nodes = [];
    for (const n of nodes) {
      this.create_node(n.type);
    }
  }

  private _add_new_id() {
    this.last_id += 1;
    return this.last_id;
  }

  private _set_id(node: GraphNode) {
    node.id = this._add_new_id();
  }

  private ensureArrays(n: any) {
    n.nodes ??= [];
    n.inputs ??= [];
    n.outputs ??= [];
    n.meta ??= [];
  }

  private cloneTemplate(base: any): GraphNode {
    const node: GraphNode = JSON.parse(JSON.stringify(base));
    this.ensureArrays(node);
    // assign pin ids if absent
    node.inputs.forEach((p: any, i: number) => {
      if (typeof p.id !== "number") p.id = i;
    });
    node.outputs.forEach((p: any, i: number) => {
      if (typeof p.id !== "number") p.id = i;
    });
    return node;
  }

  private _create_node(graph: GraphNode | undefined, template: string): GraphNode | undefined {
    const base = getNodeTemplate(template);
    if (!base) throw new Error(`Node type '${template}' not found in node definitions.`);
    const node = this.cloneTemplate(base);
    this._set_id(node);
    if (graph) {
      const children = [...(node.nodes ?? [])];
      node.nodes = [];
      graph.nodes.push(node);
      for (const child of children) {
        const childNode = this._create_node(node, child.type);
        if (!childNode) throw new Error(`Failed to create child node '${child.type}'`);
      }
    }
    return node;
  }

  public create_node(template: string, target_graph?: GraphNode): GraphNode {
    if (!target_graph) target_graph = this.graph_data;
    const node = this._create_node(target_graph, template);
    if (!node) throw new Error(`Failed to create node '${template}'`);
    return node;
  }

  public add_node_to_graph(node: GraphNode) {
    if (!node) throw new Error("Cannot add a null node to graph.");
    this._set_id(node);
    this.ensureArrays(this.graph_data);
    this.graph_data.nodes.push(node);
  }

  public get_node_by_type(type: string): GraphNode | undefined {
    return this.graph_data.nodes.find(n => n.type === type);
  }

  public find_nested_node_by_type(parent: GraphNode, type: string): GraphNode | undefined {
    return parent.nodes?.find(n => n.type === type);
  }

  public get_input(node: GraphNode, id: number): InputPin {
    const f = node.inputs.find(i => i.id === id);
    if (!f) throw new Error(`Input with id '${id}' not found in node '${node.type}'`);
    return f;
  }

  public get_output(node: GraphNode, id: number): OutputPin {
    const f = node.outputs.find(i => i.id === id);
    if (!f) throw new Error(`Output with id '${id}' not found in node '${node.type}'`);
    return f;
  }

  public connect_nodes(from_node: GraphNode, to_node: GraphNode, from_pin: number, to_pin: number) {
    const input = this.get_input(to_node, to_pin);
    const output = this.get_output(from_node, from_pin);
    (output as any).value = `../${to_node.id}/${input.id}`;
    input.value = `../${from_node.id}/${output.id}`;
  }

  public add_meta(value: string) {
    if (!Array.isArray(this.graph_data.meta)) this.graph_data.meta = [];
    this.graph_data.meta.push(value);
  }

  public to_dict(): Graph {
    return this.graph_data;
  }
}
