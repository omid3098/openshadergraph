import os
import sys
import yaml

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from core.node import Node

# --- Predefined Variables ---
SHADER_NAME = 'BasicShader_Subgraph'
SHADER_TYPE = 'surface'


# --- Main Execution ---
if __name__ == '__main__':
    print('---------------------- Shader Generation Script ---------------------')
    print(f'Generating a graph for shader {SHADER_NAME} of type {SHADER_TYPE}...')
    
    surface_graph = Node('surface')

    # add external subgraph
    surface_graph.create_external_node("/Users/omid3098/Documents/w/Godot/openshadergraph/amghezi.yml")

    # save it as SHADER_NAME.yml in the project root directory
    shader_file_path = os.path.join(os.getcwd(), f'{SHADER_NAME}.yml')
    with open(shader_file_path, 'w') as f:
        yaml.dump(surface_graph.to_dict(), f, default_flow_style=False, sort_keys=False)

