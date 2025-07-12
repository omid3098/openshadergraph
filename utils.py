import os
import yaml

nodes_root_path = os.path.join("data", "nodes")

def add_node_to_graph(graph, node):
    if node is None:
        raise ValueError("Cannot add a None node to a None graph.")
    if 'nodes' not in graph:
        graph['nodes'] = []
    node_index = len(graph['nodes']) if isinstance(graph['nodes'], list) else 0
    if 'id' not in node:
        node['id'] = -1
    node['id'] = node_index
    graph['nodes'].append(node)

def create_node_of_type(node_name: str):
    """
    Creates a node of the specified type from existing node definitions.
    """
    for root, dirs, files in os.walk(nodes_root_path):
        for file in files:
            if file == f"{node_name}.yml":
                # return the content of the yml file
                with open(os.path.join(root, file), 'r') as f:
                    return yaml.safe_load(f)
    raise ValueError(f"Node type '{node_name}' not found in node definitions.")
                
def create_graph_of_type(name: str):
    """
    Creates a graph node of the specified type from existing node(graph) definitions.
    """
    return create_node_of_type(name)
    
                
def get_node_template(node_type: str, language_template: str):
    """    
    Retrieves the template for a specific node type from the language template for shader generation.
    """
    for node_name, node_data in language_template['nodes'].items():
        if node_name == node_type:
            return node_data['template']
    raise ValueError(f"Node type '{node_type}' not found in language template for language '{language_template['name']}'.")

def get_pin_template(node_type: str, pin_name: str, language_template: dict):
    """
    Retrieves the template for a specific pin of a node type from the language template for shader generation.
    """
    for node_name, node_data in language_template['nodes'].items():
        if node_name == node_type:
            for pin in node_data['outputs']:
                if pin['name'] == pin_name:
                    return pin['template']
    raise ValueError(f"Pin '{pin_name}' not found in node type '{node_type}' templates.")

def generate_unique_node_name(node):
    if node['id'] == -1:
        raise ValueError("Node ID is not set in the graph. Please set a unique ID for the node.")
    return f"{node['type']}_{node['id']}"

def generate_unique_pin_name(node, pin_name):
    """
    Generates a unique name for a pin based on the node type and pin name.
    This is useful for ensuring that pin names do not collide in the generated shader code.
    """
    if 'id' not in node or node['id'] == -1:
        raise ValueError("Node ID is not set in the graph. Please set a unique ID for the node.")
    return f"{node['type']}_{node['id']}_{pin_name}"

def get_node_data(node):
    if isinstance(node, str) and node.startswith("/"):
        node_name = node.split("/")[-1]
        node_data = create_node_of_type(node_name)
    else:
        node_data = node
    return node_data


def get_node_from_graph(graph, node_type):
    print(f"Searching in graph '{graph['title']}' for node type '{node_type}'")
    for i, node in enumerate(graph['nodes']):
        if isinstance(node, str) and node.startswith('/'):
            node_data = create_node_of_type(node.split('/')[-1])
            if node_data['type'] == node_type:
                graph['nodes'][i] = node_data
                return node_data
        elif node['type'] == node_type:
            return node
    return None

def get_node_local_path(graph_node, target_node):
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

def connect_nodes(graph, from_node, to_node, from_pin, to_pin):
    """
    Connects two nodes in the graph by linking their specified input and output pins.
    Args:
        from_node (node): The node from which the connection originates.
        to_node (node): The node to which the connection is made.
        from_pin (str): The name of the output pin on the from_node.
        to_pin (str): The name of the input pin on the to_node.
    """
    to_node_input = next((input for input in to_node['inputs'] if input['name'] == to_pin), None)
    if to_node_input is None:
        raise ValueError(f"Input pin '{to_pin}' not found in node '{to_node['type']}'.")
    from_node_output = next((output for output in from_node['outputs'] if output['name'] == from_pin), None)
    if from_node_output is None:
        raise ValueError(f"Output pin '{from_pin}' not found in node '{from_node['type']}'.")
    from_node_path = get_node_local_path(graph, from_node)
    if from_node_path is None:
        raise ValueError(f"Could not find path for node '{from_node['type']}' in the graph '{graph['title']}'.")
    
    to_node_input['value'] = f"{from_node_path}/{from_pin}"


def load_graph_from_file(file_path):
    """
    Loads a graph from a YAML file.
    Args:
        file_path (str): The path to the YAML file containing the graph definition.
    Returns:
        dict: The loaded graph.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Graph file '{file_path}' does not exist.")
    
    with open(file_path, 'r') as f:
        graph = yaml.safe_load(f)  
    return graph


def find_output_nodes(graph):
    output_nodes = []
    def traverse_nodes(nodes):
        for node in nodes:
            if isinstance(node, str) and node.startswith('/'):
                node_data = create_node_of_type(node.split('/')[-1])
            else:
                node_data = node
            
            if node_data['type'].endswith("_output"):
                output_nodes.append(node_data)
            if 'nodes' in node_data and node_data['nodes']:
                traverse_nodes(node_data['nodes'])

    traverse_nodes(graph['nodes'])
    return output_nodes

def generate_output_code(graph, output_node, language_template):
    """
    Generates the shader code for a specific output node by traversing the graph.
    Args:
        graph (dict): The shader graph containing nodes and their connections.
        output_node (dict): The output node to generate code for.
        language_template (dict): node templates for shader generation.
    Returns:
        str: The generated shader code.
    """
    code_lines = []
    # node_template = get_node_template(output_node['type'], language_template)
    # code_lines.append(node_template)
    
    def recursive_processor(node):
        # process all input pins of the node
        if 'inputs' in node:
            for input_pin in node['inputs']:
                pin_value = input_pin['value']
                print(f"Processing input pin '{input_pin['name']}' of type '{input_pin['type']}' with value '{input_pin['value']}'")
                if isinstance(pin_value, str) and pin_value.startswith('/'):
                    # This is a connection
                    parent_graph = get_parent_graph(graph, node)
                    print(f"Parent graph found: {parent_graph['type']}")
                    target_node = get_node_with_local_path(parent_graph, pin_value)
                    print(f"Target node found: {target_node['type']}")
                    target_pin_name = pin_value.split('/')[-1]
                    pin_template = get_pin_template(target_node['type'],target_pin_name, language_template)
                    pin_unique_name = generate_unique_pin_name(target_node, target_pin_name)
                    print(f"Unique pin name generated: {pin_unique_name}")
                    pin_template = pin_template.replace("{{var}}", pin_unique_name)
                    print(f"Pin template found: {pin_template}")
                    # Now I have to traverse all input pins of the target node recursively and replace

                
    
    print(f"Generating code for output node '{output_node['type']}'")
    recursive_processor(output_node)
    result = "".join(code_lines)
    print(f"Result '{output_node['type']}':\n{result}")
    return "".join(code_lines)

def get_parent_graph(graph, target_node):
    """
    Recursively finds the parent graph of a given node.
    The parent graph is the node that contains the target_node in its 'nodes' list.
    """
    if 'nodes' in graph:
        for node in graph['nodes']:
            if node is target_node:
                return graph
            
            if isinstance(node, dict):
                parent = get_parent_graph(node, target_node)
                if parent is not None:
                    return parent
            # we do not handle paths here, because paths will refer to another graphs which can not be possible to be parent of the current node.
            # Because paths will be converted to actual graph template when we change something inside the graph within that path.
            # like when the vertex pass is empty and we are processing the fragment pass.
    return None

def get_node_with_local_path(graph, local_path):
    """
    Finds a node within a graph using a local path.

    This function is designed to find a node within the immediate 'nodes' list
    of the given graph. It assumes that connections are local and not deeply nested.
    The path is expected to be in the format '/node_id/pin_name', where 'node_id'
    is used to find the node.

    Args:
        graph (dict): The graph (or subgraph) to search within.
        local_path (str): The path to the node, e.g., '/1/out'.

    Returns:
        dict or None: The found node dictionary, or None if not found.
    """
    path_parts = local_path.strip('/').split('/')
    
    try:
        # The node ID is the first part of the path. e.g., '1' in '/1/out'
        node_id = int(path_parts[0])
    except (ValueError, IndexError):
        return None

    if 'nodes' in graph:
        for node in graph['nodes']:
            # Nodes can be strings (paths to node templates) or dicts (full node data)
            if isinstance(node, dict) and node.get('id') == node_id:
                return node
    
    return None

def add_meta(graph, key, value):
    """
    Adds a meta key-value pair to the graph.
    If the meta dictionary does not exist, it creates one.
    """
    if 'meta' not in graph:
        graph['meta'] = [{}]
    graph['meta'].append({key: value})