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

export function vector_scalar_addition_graph() {
  const surface = new NodeBuilder("surface");
  const fragment_pass = surface.get_node_by_type("fragment_pass")!;
  const fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")!;
  const color_node = surface.create_node("color", fragment_pass);
  const scalar_node = surface.create_node("float", fragment_pass);
  const add_node = surface.create_node("add", fragment_pass);
  surface.connect_nodes(color_node, add_node, 0, 0);
  surface.connect_nodes(scalar_node, add_node, 0, 1);
  surface.connect_nodes(add_node, fragment_output, 0, 0);
  return { surface, fragment_pass, fragment_output, color_node, scalar_node, add_node };
}

export function vector_wave_graph() {
  const surface = new NodeBuilder("surface");
  const fragment_pass = surface.get_node_by_type("fragment_pass")!;
  const fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")!;
  const baseColor = surface.create_node("color", fragment_pass);
  const roughness = surface.create_node("float", fragment_pass);
  const time = surface.create_node("time", fragment_pass);
  const direction = surface.create_node("float3", fragment_pass);
  direction.inputs[0].value = [1, 0, 0];
  const mul = surface.create_node("multiply", fragment_pass);
  const sin = surface.create_node("sin", fragment_pass);

  surface.connect_nodes(baseColor, fragment_output, 0, 0);
  surface.connect_nodes(roughness, fragment_output, 0, 1);
  surface.connect_nodes(time, mul, 0, 0);
  surface.connect_nodes(direction, mul, 0, 1);
  surface.connect_nodes(mul, sin, 0, 0);
  surface.connect_nodes(sin, fragment_output, 0, 3);

  return { surface, fragment_pass, fragment_output, baseColor, roughness, time, direction, mul, sin };
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
  const vertex_output = surface.find_nested_node_by_type(vertex_pass, "vertex_output")!;
  const color = surface.create_node("color", vertex_pass);
  const position = surface.create_node("vertex_position", vertex_pass);
  const normal = surface.create_node("vertex_normal", vertex_pass);
  surface.connect_nodes(position, vertex_output, 0, 0);
  surface.connect_nodes(normal, vertex_output, 0, 1);
  surface.connect_nodes(color, vertex_output, 0, 2);
  return { surface, vertex_pass, vertex_output, color, position, normal };
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

export function texture_sampling_graph() {
  const surface = new NodeBuilder("surface");
  const fragment_pass = surface.get_node_by_type("fragment_pass")!;
  const fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")!;
  const textureNode = surface.create_node("texture", fragment_pass);
  const sampler = surface.create_node("texture_sampler", fragment_pass);
  const uvConst = surface.create_node("float2", fragment_pass);
  const emission = surface.create_node("float3", fragment_pass);
  const alpha = surface.create_node("float4", fragment_pass);

  uvConst.inputs[0].value = [0.5, 0.25];
  emission.inputs[0].value = [0.1, 0.2, 0.3];
  alpha.inputs[0].value = [0.9, 0.7, 0.5, 0.25];

  surface.connect_nodes(textureNode, sampler, 0, 0);
  surface.connect_nodes(uvConst, sampler, 0, 1);
  surface.connect_nodes(sampler, fragment_output, 0, 0);
  surface.connect_nodes(emission, fragment_output, 0, 3);
  surface.connect_nodes(alpha, fragment_output, 0, 5);

  return { surface, fragment_pass, fragment_output, textureNode, sampler, uvConst, emission, alpha };
}

export function texture_sampler_default_uv_graph() {
  const surface = new NodeBuilder("surface");
  const fragment_pass = surface.get_node_by_type("fragment_pass")!;
  const fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")!;
  const textureNode = surface.create_node("texture", fragment_pass);
  const sampler = surface.create_node("texture_sampler", fragment_pass);

  surface.connect_nodes(textureNode, sampler, 0, 0);
  surface.connect_nodes(sampler, fragment_output, 0, 0);

  return { surface, fragment_pass, fragment_output, textureNode, sampler };
}

export function texture_sampler_channels_graph() {
  const surface = new NodeBuilder("surface");
  const fragment_pass = surface.get_node_by_type("fragment_pass")!;
  const fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")!;
  const textureNode = surface.create_node("texture", fragment_pass);
  const sampler = surface.create_node("texture_sampler", fragment_pass);

  surface.connect_nodes(textureNode, sampler, 0, 0);
  surface.connect_nodes(sampler, fragment_output, 0, 0); // rgb -> Albedo
  surface.connect_nodes(sampler, fragment_output, 1, 1); // r -> Roughness
  surface.connect_nodes(sampler, fragment_output, 4, 5); // a -> Alpha

  return { surface, fragment_pass, fragment_output, textureNode, sampler };
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

export function dot_normalize_view_graph() {
  const surface = new NodeBuilder("surface");
  const fragment_pass = surface.get_node_by_type("fragment_pass")!;
  const fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")!;
  const n = surface.create_node("normal_vector", fragment_pass);
  const v = surface.create_node("view_direction", fragment_pass);
  const norm_n = surface.create_node("normalize", fragment_pass);
  const norm_v = surface.create_node("normalize", fragment_pass);
  const dot = surface.create_node("dot", fragment_pass);
  surface.connect_nodes(n, norm_n, 0, 0);
  surface.connect_nodes(v, norm_v, 0, 0);
  surface.connect_nodes(norm_n, dot, 0, 0);
  surface.connect_nodes(norm_v, dot, 0, 1);
  // Use dot as alpha, and base color constant
  const color = surface.create_node("color", fragment_pass);
  surface.connect_nodes(color, fragment_output, 0, 0);
  surface.connect_nodes(dot, fragment_output, 0, 5);
  return { surface, fragment_pass, fragment_output, n, v, norm_n, norm_v, dot, color };
}

export function transform_graph() {
  const surface = new NodeBuilder("surface");
  const fragment_pass = surface.get_node_by_type("fragment_pass")!;
  const fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")!;
  const v = surface.create_node("float3", fragment_pass);
  v.inputs[0].value = [1, 0, 0];
  const t = surface.create_node("transform", fragment_pass);
  // by default conversion is object_to_world per node definition
  surface.connect_nodes(v, t, 0, 0);
  const color = surface.create_node("color", fragment_pass);
  color.inputs[0].value = [1, 1, 1, 1];
  surface.connect_nodes(color, fragment_output, 0, 0);
  surface.connect_nodes(t, fragment_output, 0, 3); // use transformed vector as emission to ensure it compiles
  return { surface, fragment_pass, fragment_output, v, t, color };
}
