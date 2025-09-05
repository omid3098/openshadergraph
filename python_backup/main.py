import os
import yaml

from core.node import Node


# --- Predefined Variables ---
SHADER_NAME = 'BasicShader'
SHADER_TYPE = 'surface'


# --- Main Execution ---
if __name__ == '__main__':
    print('---------------------- Shader Generation Script ---------------------')
    print(f'Generating a graph for shader {SHADER_NAME} of type {SHADER_TYPE}...')
    
    # Create new graph instance
    surface_graph = Node('surface')

    surface_graph.add_meta('blend_mode_transparent')
    surface_graph.add_meta('alpha_mode_SrcAlpha_OneMinusSrcAlpha')
    
    # Add color node to the fragment pass
    fragment_pass_node = surface_graph.get_node_by_name('FragmentPass')
    color_node = surface_graph.create_node('color', fragment_pass_node)
    surface_graph.add_meta('exposed')  # Note: This might need adjustment for node-specific meta

    # Connect color node to fragment output
    fragment_out_node = surface_graph.find_nested_node_by_name(fragment_pass_node, 'FragmentOutput')
    surface_graph.connect_nodes(color_node, fragment_out_node, 0, 0)

    # print('------------------------ Loaded Surface Graph -----------------------')
    # print(yaml.dump(surface_graph.to_dict(), default_flow_style=False, sort_keys=False))

    # save it as SHADER_NAME.yml in the project root directory
    shader_file_path = os.path.join(os.getcwd(), f'{SHADER_NAME}.yml')
    with open(shader_file_path, 'w') as f:
        yaml.dump(surface_graph.to_dict(), f, default_flow_style=False, sort_keys=False)

