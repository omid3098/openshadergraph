import re
import shutil
from pathlib import Path

import yaml

from build_shader import build
from tests.graph_samples import (
    addition_graph,
    basic_color_graph,
    external_graph,
    float_graph,
    meta_graph,
    vertex_color_graph,
    water_shader_graph,
    exposed_addition_graph,
    full_fragment_graph,
)


def test_godot_color_shader(compile_graph):
    surface, _, _, color = basic_color_graph()

    shader_code = compile_graph(surface.to_dict(), "data/languages/Godot.yml", "basic_color")

    assert "shader_type spatial;" in shader_code
    assert re.search(r"vec4 color_\d+ = vec4\(1.0, 1.0, 1.0, 1.0\);", shader_code)
    assert re.search(r"ALBEDO = vec3\(color_\d+\.rgb\);", shader_code)
    assert "ROUGHNESS" not in shader_code
    assert "METALLIC" not in shader_code
    assert "EMISSION" not in shader_code
    assert "NORMAL" not in shader_code
    assert "ALPHA" not in shader_code
    out_file = Path(__file__).parent / "shaders" / "godot" / "basic_color.gdshader"
    assert out_file.exists()


def test_godot_addition_shader(compile_graph):
    surface, _, fragment_output, color_a, color_b, add_node = addition_graph()

    shader_code = compile_graph(surface.to_dict(), "data/languages/Godot.yml", "addition")

    assert re.search(r"vec4 add_\d+ = color_\d+ \+ color_\d+;", shader_code)
    assert re.search(r"ALBEDO = vec3\(add_\d+\.rgb\);", shader_code)
    out_file = Path(__file__).parent / "shaders" / "godot" / "addition.gdshader"
    assert out_file.exists()


def test_godot_float_shader_file(tmp_path, monkeypatch, compile_graph):
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

    generated_code = compile_graph(surface.to_dict(), "data/languages/Godot.yml", "float_graph")
    assert re.search(r"float float_\d+ = 0.0;", generated_code)
    out_file = Path(__file__).parent / "shaders" / "godot" / "float_graph.gdshader"
    assert out_file.exists()


def test_meta_godot_shader(compile_graph):
    surface, _, _, _ = meta_graph()
    shader_code = compile_graph(surface.to_dict(), "data/languages/Godot.yml", "meta")
    assert "render_mode blend_mix;" in shader_code
    out_file = Path(__file__).parent / "shaders" / "godot" / "meta.gdshader"
    assert out_file.exists()


def test_godot_external_shader(tmp_path, compile_graph):
    surface, initial = external_graph(tmp_path)
    shader_code = compile_graph(surface.to_dict(), "data/languages/Godot.yml", "external")
    assert "void vertex()" in shader_code
    assert len(surface.graph_data["nodes"]) == initial + 1
    out_file = Path(__file__).parent / "shaders" / "godot" / "external.gdshader"
    assert out_file.exists()


def test_godot_vertex_color_shader(compile_graph):
    surface, *_ = vertex_color_graph()
    shader_code = compile_graph(surface.to_dict(), "data/languages/Godot.yml", "vertex_color")
    assert re.search(r"COLOR = color_\d+;", shader_code)
    assert re.search(r"vec4 vertex_color_\d+ = COLOR;", shader_code)
    assert re.search(r"ALBEDO = vec3\(vertex_color_\d+\.rgb\);", shader_code)
    out_file = Path(__file__).parent / "shaders" / "godot" / "vertex_color.gdshader"
    assert out_file.exists()


def test_godot_water_shader(compile_graph):
    surface, *_ = water_shader_graph()
    shader_code = compile_graph(surface.to_dict(), "data/languages/Godot.yml", "water")
    assert re.search(r"float time_\d+ = TIME;", shader_code)
    assert re.search(r"float sin_\d+ = sin\(time_\d+\);", shader_code)
    assert re.search(r"uniform float float_\d+ = 0.5;", shader_code)
    assert re.search(r"float mul_\d+ = sin_\d+ \* float_\d+;", shader_code)
    assert re.search(r"vec3 vertex_\d+ = VERTEX;", shader_code)
    assert re.search(r"vec3 vec3_\d+ = vec3\(0.0, mul_\d+, 0.0\);", shader_code)
    assert re.search(r"vec3 add_\d+ = vertex_\d+ \+ vec3_\d+;", shader_code)
    assert re.search(r"VERTEX = add_\d+;", shader_code)
    assert re.search(r"float xyz_\d+_y = vertex_\d+\.y;", shader_code)
    assert re.search(r"vec4 mix_\d+ = mix\(color_\d+, color_\d+, xyz_\d+_y\);", shader_code)
    assert re.search(r"COLOR = mix_\d+;", shader_code)
    assert re.search(r"vec4 vertex_color_\d+ = COLOR;", shader_code)
    assert re.search(r"ALBEDO = vec3\(vertex_color_\d+\.rgb\);", shader_code)
    out_file = Path(__file__).parent / "shaders" / "godot" / "water.gdshader"
    assert out_file.exists()


def test_godot_exposed_addition_shader(compile_graph):
    surface, _, _, red, green, add_node = exposed_addition_graph()

    shader_code = compile_graph(surface.to_dict(), "data/languages/Godot.yml", "exposed")

    assert re.search(r"uniform vec4 color_\d+ = vec4\(1.0, 0.0, 0.0, 1.0\);", shader_code)
    assert re.search(r"uniform vec4 color_\d+ = vec4\(0.0, 1.0, 0.0, 1.0\);", shader_code)
    assert re.search(r"vec4 add_\d+ = color_\d+ \+ color_\d+;", shader_code)
    assert re.search(r"ALBEDO = vec3\(add_\d+\.rgb\);", shader_code)
    out_file = Path(__file__).parent / "shaders" / "godot" / "exposed.gdshader"
    assert out_file.exists()


def test_godot_fragment_output_features(compile_graph):
    surface, _, fragment_output, albedo, rough, metallic, emission, normal, alpha = full_fragment_graph()

    shader_code = compile_graph(surface.to_dict(), "data/languages/Godot.yml", "fragment_features")

    assert re.search(r"ALBEDO = vec3\(color_\d+\.rgb\);", shader_code)
    assert re.search(r"ROUGHNESS = float_\d+;", shader_code)
    assert re.search(r"METALLIC = float_\d+;", shader_code)
    assert re.search(r"EMISSION = vec3\(color_\d+\.rgb\);", shader_code)
    assert re.search(r"NORMAL = vec3\(color_\d+\.rgb\);", shader_code)
    assert re.search(r"ALPHA = float_\d+;", shader_code)
    out_file = Path(__file__).parent / "shaders" / "godot" / "fragment_features.gdshader"
    assert out_file.exists()

