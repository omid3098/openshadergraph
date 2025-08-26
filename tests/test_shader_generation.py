import re
import shutil
import yaml

from core.node import Node
from build_shader import build


def test_godot_color_shader(surface_graph, compile_graph):
    surface, fragment_pass, fragment_output = surface_graph

    color = surface.create_node("color", fragment_pass)
    surface.connect_nodes(color, fragment_output, 0, 0)

    shader_code = compile_graph(surface.to_dict(), "data/languages/Godot.yml")

    assert "shader_type spatial;" in shader_code
    assert re.search(r"vec4 color_\d+ = vec4\(1.0, 1.0, 1.0, 1.0\);", shader_code)
    assert re.search(r"ALBEDO = vec3\(\(color_\d+\)\.rgb\);", shader_code)


def test_unity_color_shader(surface_graph, compile_graph):
    surface, fragment_pass, fragment_output = surface_graph

    color = surface.create_node("color", fragment_pass)
    surface.connect_nodes(color, fragment_output, 0, 0)

    shader_code = compile_graph(surface.to_dict(), "data/languages/Unity.yml")

    assert re.search(r"float4 color_\d+ = float4\(1.0, 1.0, 1.0, 1.0\);", shader_code)
    assert re.search(r"o.Albedo = float3\(\(color_\d+\)\.rgb\);", shader_code)


def test_godot_addition_shader(surface_graph, compile_graph):
    surface, fragment_pass, fragment_output = surface_graph
    color_a = surface.create_node("color", fragment_pass)
    color_b = surface.create_node("color", fragment_pass)
    add_node = surface.create_node("add", fragment_pass)

    surface.connect_nodes(color_a, add_node, 0, 0)
    surface.connect_nodes(color_b, add_node, 0, 1)
    surface.connect_nodes(add_node, fragment_output, 0, 0)

    shader_code = compile_graph(surface.to_dict(), "data/languages/Godot.yml")

    assert re.search(r"vec4 add_\d+ = color_\d+ \+ color_\d+;", shader_code)
    assert re.search(r"ALBEDO = vec3\(\(add_\d+\)\.rgb\);", shader_code)


def test_godot_float_shader_file(surface_graph, tmp_path, monkeypatch):
    surface, fragment_pass, fragment_output = surface_graph

    roughness = surface.create_node("float", fragment_pass)
    surface.connect_nodes(roughness, fragment_output, 0, 1)

    graph_path = tmp_path / "float_graph.yml"
    with open(graph_path, "w") as f:
        yaml.dump(surface.to_dict(), f, default_flow_style=False, sort_keys=False)

    shutil.copytree("data", tmp_path / "data")
    monkeypatch.chdir(tmp_path)

    build("float_graph")
    shader_file = tmp_path / "float_graph.gdshader"
    assert shader_file.exists()

    shader_code = shader_file.read_text()
    assert re.search(r"float float_\d+ = 0.0;", shader_code)
    assert re.search(r"ROUGHNESS = float_\d+;", shader_code)

