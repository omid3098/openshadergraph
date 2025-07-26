import os
import sys
import yaml

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from core.node import Node
from build_shader import *

SHADER_NAME = "FloatNode_Test"
SHADER_TYPE = "surface"

def save_graph(graph):
    graph_path = os.path.join('', f'{SHADER_NAME}.yml')
    with open(graph_path, 'w') as f:
        yaml.dump(graph.to_dict(), f, default_flow_style=False, sort_keys=False)

if __name__ == "__main__":
    print("---------------------- Shader Generation Script ---------------------")
    print(f"Generating a graph for shader '{SHADER_NAME}' of type '{SHADER_TYPE}'...")

    surface_graph = Node(SHADER_TYPE)

    fragment_pass_node = surface_graph.get_node_by_type('fragment_pass')

    # Add float node to the fragment pass
    roughness_float = surface_graph.create_node('float', fragment_pass_node)
    metallic_float = surface_graph.create_node('float', fragment_pass_node)

    # Connect float node to fragment output
    fragment_output_node = surface_graph.find_nested_node_by_type(fragment_pass_node, 'fragment_output')
    if fragment_output_node:
        surface_graph.connect_nodes(roughness_float, fragment_output_node, 0, 1)
        # surface_graph.connect_nodes(metallic_float, fragment_output_node, 0, 2)

    save_graph(surface_graph)
    build(SHADER_NAME)

