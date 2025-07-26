import os
import sys
import yaml

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from utils import *
from build_shader import *

SHADER_NAME = "FloatNode_Test"
SHADER_TYPE = "surface"

def save_graph(graph):
    graph_path = os.path.join('', f'{SHADER_NAME}.yml')
    with open(graph_path, 'w') as f:
        yaml.dump(graph, f, default_flow_style=False, sort_keys=False)

if __name__ == "__main__":
    print("---------------------- Shader Generation Script ---------------------")
    print(f"Generating a graph for shader '{SHADER_NAME}' of type '{SHADER_TYPE}'...")

    gu = GraphUtil()
    surface_graph = gu.create_graph(SHADER_TYPE)

    fragment_pass_node = gu.get_node_by_type(surface_graph, 'fragment_pass')

    # Add float node to the fragment pass
    roughness_float = gu.create_node(fragment_pass_node, 'float')
    metallic_float = gu.create_node(fragment_pass_node, 'float')

    # Connect float node to fragment output
    fragment_output_node = gu.get_node_by_type(fragment_pass_node, 'fragment_output')
    gu.connect_nodes(roughness_float, fragment_output_node, 0, 1)
    # gu.connect_nodes(metallic_float, fragment_output_node, 0, 2)

    save_graph(surface_graph)
    build(SHADER_NAME)

