import sys
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import pytest
import yaml

from core.node import Node
from core.graph_compiler import GraphCompiler


SHADERS_DIR = ROOT / "tests" / "shaders"


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
        engine = Path(language_file).stem
        out_dir = SHADERS_DIR / engine
        out_dir.mkdir(parents=True, exist_ok=True)
        out_file = out_dir / f"{name}.{ext}"
        out_file.write_text(compiler.result_code)

        return compiler.result_code

    return _compile
