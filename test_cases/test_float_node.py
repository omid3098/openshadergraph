import os
import sys
import yaml

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from utils import *

SHADER_NAME = "MultiplyNode_Test"
SHADER_TYPE = "surface"

if __name__ == "__main__":
    print("---------------------- Shader Generation Script ---------------------")
    print(f"Generating a graph for shader '{SHADER_NAME}' of type '{SHADER_TYPE}'...")

    surface_graph = create_graph_of_type("surface")

    add_meta(surface_graph, "render_mode", "transparent")

    # Add float node to the fragment pass
    float_node_a = create_node_of_type('float')
    fragment_pass_node = get_node(surface_graph, 'fragment_pass')
    add_node_to_graph(fragment_pass_node, float_node_a)
    add_meta(float_node_a, "exposable", True)



    # Connect color node to fragment output
    fragment_output_node = get_node(fragment_pass_node, 'fragment_output')
    connect_nodes(graph=fragment_pass_node, from_node=float_node_a, to_node=fragment_output_node, from_pin='out',
                  to_pin='Roughness')

    # save it as SHADER_NAME.yml in the project root directory
    shader_file_path = os.path.join(os.getcwd(), f"{SHADER_NAME}.yml")
    with open(shader_file_path, 'w') as f:
        yaml.dump(surface_graph, f, default_flow_style=False, sort_keys=False)

