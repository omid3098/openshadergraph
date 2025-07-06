
import yaml
import os
import copy

# --- Predefined Variables ---
SHADER_NAME = "BasicShader"
SHADER_TYPE = "surface"
LANGUAGE = "Godot"

def create_node(node_template, node_type, node_id, title, position, inputs=None, outputs=None, nodes=None):
    node = copy.deepcopy(node_template)
    node['type'] = node_type
    node['id'] = node_id
    node['title'] = title
    node['position'] = position
    if inputs is not None:
        node['inputs'] = inputs
    if outputs is not None:
        node['outputs'] = outputs
    if nodes is not None:
        node['nodes'] = nodes
    return node

def get_node_path(graph_node, target_node):
    """
    Finds the path of a node within the graph hierarchy.
    The path is represented as a string like '/id1/id2/...'.
    """
    def find_path(current_node, target, path_prefix):
        if 'nodes' in current_node and current_node['nodes']:
            for node in current_node['nodes']:
                current_path = f"{path_prefix}/{node['id']}"
                if node is target:
                    return current_path
                
                found_path = find_path(node, target, current_path)
                if found_path:
                    return found_path
        return None

    return find_path(graph_node, target_node, "")


def create_connection(graph_data, from_node, from_output, to_node, to_input):
    # Find the correct output pin in the from_node
    output_pin = next((output for output in from_node['outputs'] if output['name'] == from_output), None)
    if output_pin is None:
        raise ValueError(f"Output '{from_output}' not found in node '{from_node['title']}'")
    # Find the correct input pin in the to_node
    input_pin = next((input for input in to_node['inputs'] if input['name'] == to_input), None)
    if input_pin is None:
        raise ValueError(f"Input '{to_input}' not found in node '{to_node['title']}'")
    # Create the connection
    from_node_path = get_node_path(graph_data, from_node)
    if from_node_path is None:
        raise ValueError(f"Could not find path for node '{from_node['title']}'")
    input_pin['value'] = f"{from_node_path}/{from_output}" 

# --- Graph Creation Logic ---
def create_graph_data(shader_type, shader_name, node_template):
    graph_data = create_node(node_template, shader_type, 0, shader_name, [0, 0])

    # vertex node
    vertex_node = create_node(node_template, 'vertex_pass', 0, 'VertexPass', [0, 0])
    graph_data['nodes'].append(vertex_node)

    # fragment node
    fragment_node = create_node(node_template, 'fragment_pass', 1, 'FragmentPass', [10, 0])

    # Color node within the fragment pass
    color_node = create_node(node_template, 'color', 0, 'Color', [0, 0],
                             [{'name': 'Color', 'type': 'float4', 'value': [1, 0, 0, 1]}],
                             [{'name': 'Color', 'type': 'float4', 'value': [1, 0, 0, 1]}],
                             [])
    fragment_node['nodes'].append(color_node)

    # Fragment output node within the fragment pass
    fragment_output_node = create_node(node_template, 'fragment_output', 1, 'FragmentOutput', [10, 0],
                                       [{'name': 'Color', 'type': 'float4', 'value': [1, 0, 0, 1]}],
                                       [],
                                       [])
    fragment_node['nodes'].append(fragment_output_node)

    graph_data['nodes'].append(fragment_node)

    # Add connections
    # Connect color node ourtput to fragment output input
    create_connection(graph_data, color_node, 'Color', fragment_output_node, 'Color')
    
    
    return graph_data

# --- Shader Generation Logic ---
def generate_shader_code(graph_data, language):
    pass

# --- Main Execution ---
if __name__ == "__main__":
    # Everything is nodes and connections.
    # A graph is a composition node
    # A math node is a primitive node
    
    print(f"Generating shader '{SHADER_NAME}' of type '{SHADER_TYPE}'...")
    node_yaml_path = os.path.join("data", "node.yml")

    if not os.path.exists(node_yaml_path):
        raise FileNotFoundError(f"Node definition file not found at '{node_yaml_path}'")
    else:
        print(f"Node definition file found at '{node_yaml_path}'")
    
    with open(node_yaml_path, 'r') as f:
        node_template = yaml.safe_load(f)
        print(f"Node template loaded: {node_template}")
    
    graph_data = create_graph_data(SHADER_TYPE, SHADER_NAME, node_template)
    
    # Save the yaml file
    output_path = os.path.join("", SHADER_NAME + ".yml")
    with open(output_path, 'w') as f:
        yaml.dump(graph_data, f, default_flow_style=False, sort_keys=False)

