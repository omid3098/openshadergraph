import yaml

from core.node import Node


def test_basic_color_graph_yaml():
    surface = Node("surface")
    fragment_pass = surface.get_node_by_type("fragment_pass")
    fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")

    color = surface.create_node("color", fragment_pass)
    surface.connect_nodes(color, fragment_output, 0, 0)

    graph_dict = surface.to_dict()

    # Ensure the color node exists in the fragment pass
    child_types = [n["type"] for n in fragment_pass["nodes"]]
    assert "color" in child_types

    # Validate the connection in the YAML data
    assert (
        fragment_output["inputs"][0]["value"] == f"../{color['id']}/0"
    )


def test_addition_graph_yaml():
    surface = Node("surface")
    fragment_pass = surface.get_node_by_type("fragment_pass")
    fragment_output = surface.find_nested_node_by_type(fragment_pass, "fragment_output")

    color_a = surface.create_node("color", fragment_pass)
    color_b = surface.create_node("color", fragment_pass)
    add_node = surface.create_node("add", fragment_pass)

    surface.connect_nodes(color_a, add_node, 0, 0)
    surface.connect_nodes(color_b, add_node, 0, 1)
    surface.connect_nodes(add_node, fragment_output, 0, 0)

    assert add_node["inputs"][0]["value"] == f"../{color_a['id']}/0"
    assert add_node["inputs"][1]["value"] == f"../{color_b['id']}/0"
    assert (
        fragment_output["inputs"][0]["value"] == f"../{add_node['id']}/0"
    )


def test_external_graph_yaml(tmp_path):
    external_graph = Node("color")
    external_path = tmp_path / "external.yml"
    with open(external_path, "w") as f:
        yaml.dump(
            external_graph.to_dict(),
            f,
            default_flow_style=False,
            sort_keys=False,
        )

    main_graph = Node("surface")
    initial_count = len(main_graph.graph_data["nodes"])
    main_graph.create_external_node(str(external_path))

    assert len(main_graph.graph_data["nodes"]) == initial_count + 1
    assert main_graph.graph_data["nodes"][-1]["type"] == "color"

