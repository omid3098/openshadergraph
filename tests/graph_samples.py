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
