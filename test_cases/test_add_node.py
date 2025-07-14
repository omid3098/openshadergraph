import os
import sys
import yaml

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from utils import *

SHADER_NAME = "AddNode_Test"
SHADER_TYPE = "surface"

def save_graph(graph):
    graph_path = os.path.join('', f'{SHADER_NAME}.yml')
    with open(graph_path, 'w') as f:
        yaml.dump(graph, f, default_flow_style=False, sort_keys=False)

if __name__ == "__main__":
    print("---------------------- Shader Generation Script ---------------------")
    print(f"Generating a graph for shader '{SHADER_NAME}' of type '{SHADER_TYPE}'...")

    surface_graph = create_graph_of_type("surface")

    add_meta(surface_graph, "render_mode", "opaque")
    
    fragment_pass_node = get_node(surface_graph, 'fragment_pass')
    fragment_output_node = get_node(fragment_pass_node, 'fragment_output')
    
    # Add color node to the fragment pass
    color1 = create_node_of_type('color') 
    color2 = create_node_of_type('color')
    add_node = create_node_of_type('add')

    add_node_to_graph(fragment_pass_node, color1)
    add_node_to_graph(fragment_pass_node, color2)
    add_node_to_graph(fragment_pass_node, add_node)
    
    add_meta(color1, "exposable", True)

    # Connections
    connect_nodes(graph=fragment_pass_node, from_node=color1, to_node=add_node, from_pin='out', to_pin='a')
    connect_nodes(graph=fragment_pass_node, from_node=color2, to_node=add_node, from_pin='out', to_pin='b')
    connect_nodes(graph=fragment_pass_node, from_node=add_node, to_node=fragment_output_node, from_pin='out', to_pin='Color')
    
    save_graph(surface_graph)