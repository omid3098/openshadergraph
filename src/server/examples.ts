import { NodeBuilder } from "../core/graph/node";

export async function examplesHandler(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const name = url.searchParams.get("name");

    const registry: Array<{ key: string; label: string; build: () => any }> = [
      {
        key: "basic_color",
        label: "Basic Color",
        build: () => {
          const surface = new NodeBuilder("surface");
          const fragment_pass = surface.get_node_by_type("fragment_pass")!;
          const fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")!;
          const color = surface.create_node("color", fragment_pass);
          surface.connect_nodes(color, fragment_output, 0, 0);
          return surface.to_dict();
        },
      },
      {
        key: "addition",
        label: "Addition (Color + Color)",
        build: () => {
          const surface = new NodeBuilder("surface");
          const fragment_pass = surface.get_node_by_type("fragment_pass")!;
          const fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")!;
          const a = surface.create_node("color", fragment_pass);
          const b = surface.create_node("color", fragment_pass);
          const add = surface.create_node("add", fragment_pass);
          surface.connect_nodes(a, add, 0, 0);
          surface.connect_nodes(b, add, 0, 1);
          surface.connect_nodes(add, fragment_output, 0, 0);
          return surface.to_dict();
        },
      },
      {
        key: "float_to_roughness",
        label: "Float → Roughness",
        build: () => {
          const surface = new NodeBuilder("surface");
          const fragment_pass = surface.get_node_by_type("fragment_pass")!;
          const fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")!;
          const flt = surface.create_node("float", fragment_pass);
          surface.connect_nodes(flt, fragment_output, 0, 1);
          return surface.to_dict();
        },
      },
      {
        key: "exposed_addition",
        label: "Exposed Addition",
        build: () => {
          const surface = new NodeBuilder("surface");
          const fragment_pass = surface.get_node_by_type("fragment_pass")!;
          const fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")!;
          const red = surface.create_node("color", fragment_pass);
          const green = surface.create_node("color", fragment_pass);
          red.inputs[0].value = [1.0, 0.0, 0.0, 1.0];
          green.inputs[0].value = [0.0, 1.0, 0.0, 1.0];
          red.meta!.push("exposed");
          green.meta!.push("exposed");
          const add = surface.create_node("add", fragment_pass);
          surface.connect_nodes(red, add, 0, 0);
          surface.connect_nodes(green, add, 0, 1);
          surface.connect_nodes(add, fragment_output, 0, 0);
          return surface.to_dict();
        },
      },
      {
        key: "full_fragment",
        label: "Full Fragment Outputs",
        build: () => {
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
          return surface.to_dict();
        },
      },
    ];

    if (name) {
      const found = registry.find((r) => r.key === name);
      if (!found) return new Response("Not Found", { status: 404 });
      const graph = found.build();
      return Response.json({ key: found.key, label: found.label, graph });
    }

    return Response.json({ examples: registry.map((r) => ({ key: r.key, label: r.label })) });
  } catch (err) {
    console.error("/api/example-graphs failed:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}

