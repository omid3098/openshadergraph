import yaml

from tests.graph_samples import (
    addition_graph,
    basic_color_graph,
    external_graph,
    meta_graph,
    vertex_color_graph,
)


def test_basic_color_graph_yaml():
    surface, fragment_pass, fragment_output, color = basic_color_graph()

    child_types = [n["type"] for n in fragment_pass["nodes"]]
    assert "color" in child_types
    assert fragment_output["inputs"][0]["value"] == f"../{color['id']}/0"


def test_addition_graph_yaml():
    surface, fragment_pass, fragment_output, color_a, color_b, add_node = addition_graph()

    assert add_node["inputs"][0]["value"] == f"../{color_a['id']}/0"
    assert add_node["inputs"][1]["value"] == f"../{color_b['id']}/0"
    assert fragment_output["inputs"][0]["value"] == f"../{add_node['id']}/0"


def test_external_graph_yaml(tmp_path):
    surface, initial_count = external_graph(tmp_path)

    assert len(surface.graph_data["nodes"]) == initial_count + 1
    assert surface.graph_data["nodes"][-1]["type"] == "color"


def test_nested_vertex_graph_yaml():
    surface, vertex_pass, color = vertex_color_graph()
    nested = surface.find_nested_node_by_type(vertex_pass, "color")
    assert nested is not None
    assert nested["id"] == color["id"]


def test_node_meta_yaml():
    surface, _, _, _ = meta_graph()
    assert surface.graph_data["meta"] == ["blend_mode_transparent"]

