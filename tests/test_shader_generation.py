import re
import shutil
import yaml

from build_shader import build
from tests.graph_samples import addition_graph, basic_color_graph, float_graph, meta_graph


def test_godot_color_shader(compile_graph):
    surface, _, _, color = basic_color_graph()

    shader_code = compile_graph(surface.to_dict(), "data/languages/Godot.yml")

    assert "shader_type spatial;" in shader_code
    assert re.search(r"vec4 color_\d+ = vec4\(1.0, 1.0, 1.0, 1.0\);", shader_code)
    assert re.search(r"ALBEDO = vec3\(\(color_\d+\)\.rgb\);", shader_code)


def test_unity_color_shader(compile_graph):
    surface, _, _, color = basic_color_graph()

    shader_code = compile_graph(surface.to_dict(), "data/languages/Unity.yml")

    assert re.search(r"float4 color_\d+ = float4\(1.0, 1.0, 1.0, 1.0\);", shader_code)
    assert re.search(r"o.Albedo = float3\(\(color_\d+\)\.rgb\);", shader_code)


def test_godot_addition_shader(compile_graph):
    surface, _, fragment_output, color_a, color_b, add_node = addition_graph()

    shader_code = compile_graph(surface.to_dict(), "data/languages/Godot.yml")

    assert re.search(r"vec4 add_\d+ = color_\d+ \+ color_\d+;", shader_code)
    assert re.search(r"ALBEDO = vec3\(\(add_\d+\)\.rgb\);", shader_code)


def test_godot_float_shader_file(tmp_path, monkeypatch):
    surface, _, _, float_node = float_graph()

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


def test_meta_godot_shader(compile_graph):
    surface, _, _, _ = meta_graph()
    shader_code = compile_graph(surface.to_dict(), "data/languages/Godot.yml")
    assert "render_mode blend_mix;" in shader_code


def test_meta_unity_shader(compile_graph):
    surface, _, _, _ = meta_graph()
    shader_code = compile_graph(surface.to_dict(), "data/languages/Unity.yml")
    assert 'Tags { "Queue" = "Transparent" }' in shader_code

