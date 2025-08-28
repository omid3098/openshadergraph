from core.node import Node
import yaml


def basic_color_graph():
    surface = Node("surface")
    fragment_pass = surface.get_node_by_type("fragment_pass")
    fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")
    color = surface.create_node("color", fragment_pass)
    surface.connect_nodes(color, fragment_output, 0, 0)
    return surface, fragment_pass, fragment_output, color


def addition_graph():
    surface = Node("surface")
    fragment_pass = surface.get_node_by_type("fragment_pass")
    fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")
    color_a = surface.create_node("color", fragment_pass)
    color_b = surface.create_node("color", fragment_pass)
    add_node = surface.create_node("add", fragment_pass)
    surface.connect_nodes(color_a, add_node, 0, 0)
    surface.connect_nodes(color_b, add_node, 0, 1)
    surface.connect_nodes(add_node, fragment_output, 0, 0)
    return surface, fragment_pass, fragment_output, color_a, color_b, add_node


def float_graph():
    surface = Node("surface")
    fragment_pass = surface.get_node_by_type("fragment_pass")
    fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")
    float_node = surface.create_node("float", fragment_pass)
    surface.connect_nodes(float_node, fragment_output, 0, 1)
    return surface, fragment_pass, fragment_output, float_node


def meta_graph():
    surface, fragment_pass, fragment_output, color = basic_color_graph()
    surface.add_meta("blend_mode_transparent")
    return surface, fragment_pass, fragment_output, color

def external_graph(tmp_path):
    external = Node("color")
    external_path = tmp_path / "external.yml"
    with open(external_path, "w") as f:
        yaml.dump(external.to_dict(), f, default_flow_style=False, sort_keys=False)
    surface = Node("surface")
    initial_count = len(surface.graph_data["nodes"])
    surface.create_external_node(str(external_path))
    return surface, initial_count


def vertex_color_graph():
    surface = Node("surface")
    vertex_pass = surface.get_node_by_type("vertex_pass")
    color = surface.create_node("color", vertex_pass)
    return surface, vertex_pass, color


def exposed_addition_graph():
    """Graph with two exposed color parameters added together."""
    surface = Node("surface")
    fragment_pass = surface.get_node_by_type("fragment_pass")
    fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")

    red = surface.create_node("color", fragment_pass)
    green = surface.create_node("color", fragment_pass)

    # Set default colors
    red["inputs"][0]["value"] = [1.0, 0.0, 0.0, 1.0]
    green["inputs"][0]["value"] = [0.0, 1.0, 0.0, 1.0]

    # Expose the parameters
    red["meta"].append("exposed")
    green["meta"].append("exposed")

    add_node = surface.create_node("add", fragment_pass)
    surface.connect_nodes(red, add_node, 0, 0)
    surface.connect_nodes(green, add_node, 0, 1)
    surface.connect_nodes(add_node, fragment_output, 0, 0)

    return surface, fragment_pass, fragment_output, red, green, add_node


def full_fragment_graph():
    """Graph exercising all fragment output features."""
    surface = Node("surface")
    fragment_pass = surface.get_node_by_type("fragment_pass")
    fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")

    albedo = surface.create_node("color", fragment_pass)
    rough = surface.create_node("float", fragment_pass)
    metallic = surface.create_node("float", fragment_pass)
    emission = surface.create_node("color", fragment_pass)
    normal = surface.create_node("color", fragment_pass)
    alpha = surface.create_node("float", fragment_pass)

    surface.connect_nodes(albedo, fragment_output, 0, 0)
    surface.connect_nodes(rough, fragment_output, 0, 1)
    surface.connect_nodes(metallic, fragment_output, 0, 2)
    surface.connect_nodes(emission, fragment_output, 0, 3)
    surface.connect_nodes(normal, fragment_output, 0, 4)
    surface.connect_nodes(alpha, fragment_output, 0, 5)

    return (
        surface,
        fragment_pass,
        fragment_output,
        albedo,
        rough,
        metallic,
        emission,
        normal,
        alpha,
    )


def water_graph():
    """Graph that samples screen depth to blend shallow and deep water colors."""
    surface = Node("surface")
    fragment_pass = surface.get_node_by_type("fragment_pass")
    fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")

    uv = surface.create_node("uv", fragment_pass)
    screen_depth = surface.create_node("screen_depth", fragment_pass)
    surface.connect_nodes(uv, screen_depth, 0, 0)

    depth_scale = surface.create_node("float", fragment_pass)
    depth_scale["inputs"][0]["value"] = [5.0]

    multiply = surface.create_node("multiply", fragment_pass)
    surface.connect_nodes(screen_depth, multiply, 0, 0)
    surface.connect_nodes(depth_scale, multiply, 0, 1)

    saturate = surface.create_node("saturate", fragment_pass)
    surface.connect_nodes(multiply, saturate, 0, 0)

    shallow = surface.create_node("color", fragment_pass)
    shallow["inputs"][0]["value"] = [0.0, 0.5, 1.0, 1.0]
    shallow["meta"].append("exposed")

    deep = surface.create_node("color", fragment_pass)
    deep["inputs"][0]["value"] = [0.0, 0.0, 0.5, 1.0]
    deep["meta"].append("exposed")

    lerp = surface.create_node("lerp", fragment_pass)
    surface.connect_nodes(shallow, lerp, 0, 0)
    surface.connect_nodes(deep, lerp, 0, 1)
    surface.connect_nodes(saturate, lerp, 0, 2)
    surface.connect_nodes(lerp, fragment_output, 0, 0)

    return surface, fragment_pass, fragment_output, shallow, deep, lerp
