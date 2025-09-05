import { NodeBuilder } from "../src/core/graph/node";

export function basic_color_graph() {
  const surface = new NodeBuilder("surface");
  const fragment_pass = surface.get_node_by_type("fragment_pass")!;
  const fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")!;
  const color = surface.create_node("color", fragment_pass);
  surface.connect_nodes(color, fragment_output, 0, 0);
  return { surface, fragment_pass, fragment_output, color };
}

export function addition_graph() {
  const surface = new NodeBuilder("surface");
  const fragment_pass = surface.get_node_by_type("fragment_pass")!;
  const fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")!;
  const color_a = surface.create_node("color", fragment_pass);
  const color_b = surface.create_node("color", fragment_pass);
  const add_node = surface.create_node("add", fragment_pass);
  surface.connect_nodes(color_a, add_node, 0, 0);
  surface.connect_nodes(color_b, add_node, 0, 1);
  surface.connect_nodes(add_node, fragment_output, 0, 0);
  return { surface, fragment_pass, fragment_output, color_a, color_b, add_node };
}

export function float_graph() {
  const surface = new NodeBuilder("surface");
  const fragment_pass = surface.get_node_by_type("fragment_pass")!;
  const fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")!;
  const float_node = surface.create_node("float", fragment_pass);
  surface.connect_nodes(float_node, fragment_output, 0, 1);
  return { surface, fragment_pass, fragment_output, float_node };
}

export function meta_graph() {
  const { surface, fragment_pass, fragment_output, color } = basic_color_graph();
  surface.add_meta("blend_mode_transparent");
  return { surface, fragment_pass, fragment_output, color };
}

export function external_graph(tmpdir: string) {
  // External graph stored in JSON now (canonical format)
  const external = new NodeBuilder("color");
  const { writeFileSync } = require("fs");
  const path = require("path");
  const external_path = path.join(tmpdir, "external.json");
  writeFileSync(external_path, JSON.stringify(external.to_dict(), null, 2), "utf8");

  const surface = new NodeBuilder("surface");
  const initial_count = surface.graph_data.nodes.length;
  // Mimic external import: just add the parsed node object to graph
  const json = JSON.parse(require("fs").readFileSync(external_path, "utf8"));
  surface.add_node_to_graph(json);
  return { surface, initial_count };
}

export function vertex_color_graph() {
  const surface = new NodeBuilder("surface");
  const vertex_pass = surface.get_node_by_type("vertex_pass")!;
  const color = surface.create_node("color", vertex_pass);
  return { surface, vertex_pass, color };
}

export function exposed_addition_graph() {
  const surface = new NodeBuilder("surface");
  const fragment_pass = surface.get_node_by_type("fragment_pass")!;
  const fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")!;
  const red = surface.create_node("color", fragment_pass);
  const green = surface.create_node("color", fragment_pass);
  // defaults
  red.inputs[0].value = [1.0, 0.0, 0.0, 1.0];
  green.inputs[0].value = [0.0, 1.0, 0.0, 1.0];
  red.meta!.push("exposed");
  green.meta!.push("exposed");
  const add_node = surface.create_node("add", fragment_pass);
  surface.connect_nodes(red, add_node, 0, 0);
  surface.connect_nodes(green, add_node, 0, 1);
  surface.connect_nodes(add_node, fragment_output, 0, 0);
  return { surface, fragment_pass, fragment_output, red, green, add_node };
}

export function full_fragment_graph() {
  const surface = new NodeBuilder("surface");
  const fragment_pass = surface.get_node_by_type("fragment_pass")!;
  const fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")!;
  const albedo = surface.create_node("color", fragment_pass);
  const rough = surface.create_node("float", fragment_pass);
  const metallic = surface.create_node("float", fragment_pass);
  const emission = surface.create_node("color", fragment_pass);
  const normal = surface.create_node("color", fragment_pass);
  const alpha = surface.create_node("float", fragment_pass);
  surface.connect_nodes(albedo, fragment_output, 0, 0);
  surface.connect_nodes(rough, fragment_output, 0, 1);
  surface.connect_nodes(metallic, fragment_output, 0, 2);
  surface.connect_nodes(emission, fragment_output, 0, 3);
  surface.connect_nodes(normal, fragment_output, 0, 4);
  surface.connect_nodes(alpha, fragment_output, 0, 5);
  return { surface, fragment_pass, fragment_output, albedo, rough, metallic, emission, normal, alpha };
}
