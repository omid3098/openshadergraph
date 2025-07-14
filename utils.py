import os
import yaml


class GraphUtil:
    def __init__(self):
        self.nodes_root_path = os.path.join("data", "nodes")
        self.templates = {}
        self.last_id = -1
        self.load_tempates()
        
    def load_tempates(self):
        for root, dirs, files in os.walk(self.nodes_root_path):
            for file in files:
                with open(os.path.join(root, file), 'r') as f:
                    template_name = file.split('.')[0]
                    self.templates[template_name] = yaml.safe_load(f)

    def add_new_id(self):
        self.last_id += 1
        return self.last_id
    
    def set_id(self, node):
        node['id'] = self.add_new_id()
        # node = {'id': node['id'], **{k: v for k, v in node.items() if k != 'id'}}

    def add_node_to_graph(self, graph, node):
        if node is None:
            raise ValueError("Cannot add a None node to a None graph.")
        if 'nodes' not in graph:
            graph['nodes'] = []
        self.set_id(node)
        graph['nodes'].append(node)


    def create_node(self, graph, template: str):
        """
        Creates a node of the specified type from existing node definitions.
        """
        if template in self.templates:
            node = self.templates[template].copy()
            self.set_id(node)
            if graph:
                nodes = node['nodes'].copy()
                node['nodes'] = []
                graph['nodes'].append(node)
                for child_node in nodes:
                    self.create_node(node, child_node['type'])
            return node
        raise ValueError(f"Node type '{template}' not found in node definitions.")
                
    def create_graph(self, template: str):
        """
        Creates a graph node of the specified type from existing node(graph) definitions.
        """
        graph = self.create_node(None, template)
        
        nodes = graph['nodes'].copy()
        graph['nodes'] = []
        for node in nodes:
            self.create_node(graph, node['type'])
        return graph
    
    def create_external_node_to_graph(self, graph, file_path):
        """
        Loads a graph from an external YAML file.
        Args:
            file_path (str): The path to the YAML file containing the graph definition.
        Returns:
            dict: The loaded graph.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Graph file '{file_path}' does not exist.")
        
        with open(file_path, 'r') as f:
            external_graph = yaml.safe_load(f)
            self.add_node_to_graph(graph, external_graph)

    def generate_unique_pin_name(self, node, pin_name):
        """
        Generates a unique name for a pin based on the node type and pin name.
        This is useful for ensuring that pin names do not collide in the generated shader code.
        """
        if 'id' not in node or node['id'] == -1:
            raise ValueError("Node ID is not set in the graph. Please set a unique ID for the node.")
        return f"{node['type']}_{node['id']}_{pin_name}"


    def get_node(self, graph, id):
        print(f"Searching in graph '{graph['name']}' for node type '{id}'")
        return graph['nodes'][id]

    def get_node_by_type(self, graph, type):
        if graph and 'type' in graph:
            print(f"Searching in graph {graph['type']} for node type '{type}'")
        result = [node for node in graph['nodes'] if node['type'] == type]
        if result:
            return result[0]

    def get_node_by_name(self, graph, name):
        if graph and 'type' in graph:
            print(f"Searching in graph {graph['type']} for node name '{name}'")
        result = [node for node in graph['nodes'] if node['name'] == name]
        if result:
            return result[0]

    def get_node_local_path(self, graph_node, target_node):
        """
        Finds the path of a node within the graph hierarchy.
        The path is represented as a string like '/id1/id2/...'.
        """
        return f'{graph_node["id"]}/{target_node["id"]}'

    def get_input(self, node, id):
        # todo: this is index based for now
        return node['inputs'][int(id)]
        # input = [input for input in node['inputs'] if input['id'] == id]
        # let it threw error if it does not exist for now
        # return input[0]

    def get_output(self, node, id):
        # todo: this is index based for now
        return node['outputs'][int(id)]
        # output = [output for output in node['outputs'] if output['id'] == id]
        # let it threw error if it does not exist for now
        # return output[0]
        
    def connect_nodes(self, from_node, to_node, from_pin, to_pin, address=''):
        """
        Connects two nodes in the graph by linking their specified input and output pins.
        Args:
            from_node (node): The node from which the connection originates.
            to_node (node): The node to which the connection is made.
            from_pin (str): The name of the output pin on the from_node.
            to_pin (str): The name of the input pin on the to_node.
        """
        input = self.get_input(to_node, to_pin)
        output = self.get_output(from_node, from_pin)
        output['value'] = f'{address}{to_node["id"]}/{input["id"]}'
        input['value'] = f'{address}{from_node["id"]}/{output["id"]}'

    def add_meta(self, graph, value):
        """
        Adds a meta key-value pair to the graph.
        If the meta dictionary does not exist, it creates one.
        """
        if 'meta' not in graph:
            graph['meta'] = []
        graph['meta'].append(value)


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