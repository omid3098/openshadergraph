import sys
import shutil
import subprocess
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import pytest
import yaml

from core.node import Node
from core.graph_compiler import GraphCompiler


SHADERS_DIR = ROOT / "tests" / "shaders"
ENGINES_DIR = ROOT / "tests" / "engines"
ENGINE_VERSIONS = {"godot": "4.4.1-stable"}


_GODOT_CACHE = None


def ensure_godot():
    """Download the Godot headless binary if needed and return paths."""
    global _GODOT_CACHE
    if _GODOT_CACHE is not None:
        return _GODOT_CACHE

    engine_dir = ENGINES_DIR / "godot"
    engine_dir.mkdir(parents=True, exist_ok=True)
    version = ENGINE_VERSIONS["godot"]
    binary = engine_dir / f"Godot_v{version}_linux.x86_64"
    script = engine_dir / "godot_compile_shader.gd"
    if not binary.exists():
        url = (
            "https://github.com/godotengine/godot/releases/download/"
            f"{version}/Godot_v{version}_linux.x86_64.zip"
        )
        zip_path = engine_dir / "godot.zip"
        try:
            urllib.request.urlretrieve(url, zip_path)
            with zipfile.ZipFile(zip_path) as zf:
                zf.extractall(engine_dir)
            binary.chmod(0o755)
        except Exception as exc:
            print(f"Failed to download Godot {version}: {exc}")
            _GODOT_CACHE = False
            return None
        finally:
            if zip_path.exists():
                zip_path.unlink()
    script.write_text(
        (
            """
extends SceneTree

func _init():
    var args = OS.get_cmdline_args()
    if args.size() == 0:
        push_error("No shader file provided")
        quit(1)
        return
    var shader_path = args[0]
    var code = FileAccess.get_file_as_string(shader_path)
    var shader = Shader.new()
    shader.code = code
    quit()
"""
        ).strip()
    )

    _GODOT_CACHE = (binary, script)
    return _GODOT_CACHE


def compile_with_godot(shader_path: Path) -> None:
    """Compile a shader using the headless Godot binary if available."""
    godot = ensure_godot()
    if not godot:
        print("Godot binary unavailable; skipping compilation check")
        return
    binary, script = godot
    proc = subprocess.run(
        [str(binary), "--headless", "-s", str(script), str(shader_path)],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0 or "Error" in proc.stderr or "ERROR" in proc.stderr:
        raise RuntimeError(f"Godot failed to compile {shader_path}:\n{proc.stderr}")


ENGINE_COMPILERS = {"godot": compile_with_godot}


@pytest.fixture(scope="session", autouse=True)
def clean_shader_dir():
    if SHADERS_DIR.exists():
        shutil.rmtree(SHADERS_DIR)


@pytest.fixture
def surface_graph():
    """Create a basic surface graph with easy access to key nodes."""
    surface = Node("surface")
    fragment_pass = surface.get_node_by_type("fragment_pass")
    fragment_output = surface.find_nested_node_by_type(
        fragment_pass, "fragment_output"
    )
    return surface, fragment_pass, fragment_output


@pytest.fixture
def compile_graph():
    """Compile the provided graph using the given language definition."""

    def _compile(graph, language_file, name="shader"):
        lang_def = yaml.safe_load(open(ROOT / language_file))
        compiler = GraphCompiler(graph, lang_def)
        compiler.compile()

        ext = lang_def["file_extensions"][0]
        engine = Path(language_file).stem.lower()
        out_dir = SHADERS_DIR / engine
        out_dir.mkdir(parents=True, exist_ok=True)
        out_file = out_dir / f"{name}.{ext}"
        out_file.write_text(compiler.result_code)

        compiler_fn = ENGINE_COMPILERS.get(engine)
        if compiler_fn:
            compiler_fn(out_file)

        return compiler.result_code

    return _compile
