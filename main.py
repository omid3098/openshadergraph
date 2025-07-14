import os
import yaml

from utils import *


# --- Predefined Variables ---
SHADER_NAME = 'BasicShader'
SHADER_TYPE = 'surface'


# --- Main Execution ---
if __name__ == '__main__':
    print('---------------------- Shader Generation Script ---------------------')
    print(f'Generating a graph for shader {SHADER_NAME} of type {SHADER_TYPE}...')
    gu = GraphUtil()
    surface_graph = gu.create_graph('surface')

    gu.add_meta(surface_graph, 'blend_mode_transparent')
    gu.add_meta(surface_graph, 'alpha_mode_SrcAlpha_OneMinusSrcAlpha')
    
    # Add color node to the fragment pass
    fragment_pass_node = gu.get_node_by_name(surface_graph, 'FragmentPass')
    color_node = gu.create_node(fragment_pass_node, 'color')
    gu.add_meta(color_node, 'exposed')

    # Connect color node to fragment output
    fragment_out_node = gu.get_node_by_name(fragment_pass_node, 'FragmentOutput')
    gu.connect_nodes(color_node, fragment_out_node, '0', '0', '../')

    # print('------------------------ Loaded Surface Graph -----------------------')
    # print(yaml.dump(surface_graph, default_flow_style=False, sort_keys=False))

    # save it as SHADER_NAME.yml in the project root directory
    shader_file_path = os.path.join(os.getcwd(), f'{SHADER_NAME}.yml')
    with open(shader_file_path, 'w') as f:
        yaml.dump(surface_graph, f, default_flow_style=False, sort_keys=False)

