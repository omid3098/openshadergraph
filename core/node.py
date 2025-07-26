import yaml
import copy
import os


class Node:
    # Class-level shared resources
    _templates = {}
    _nodes_root_path = os.path.join("data", "nodes")
    _templates_loaded = False
    
    @classmethod
    def _load_templates(cls):
        """Load templates once for all instances"""
        if cls._templates_loaded:
            return
            
        for root, dirs, files in os.walk(cls._nodes_root_path):
            for file in files:
                with open(os.path.join(root, file), 'r') as f:
                    template_name = file.split('.')[0]
                    cls._templates[template_name] = yaml.safe_load(f)
        cls._templates_loaded = True

    def __init__(self, template: str):
        """
        Creates a graph node of the specified type from existing node(graph) definitions.
        """
        Node._load_templates()
        self.last_id = -1
        self.graph_data = self._create_node(None, template)
        
        # Initialize child nodes
        nodes = self.graph_data['nodes'].copy()
        self.graph_data['nodes'] = []
        for node in nodes:
            self.create_node(node['type'])

    def _add_new_id(self):
        self.last_id += 1
        return self.last_id

    def _set_id(self, node):
        node['id'] = self._add_new_id()

    def add_node_to_graph(self, node):
        if node is None:
            raise ValueError("Cannot add a None node to graph.")
        if 'nodes' not in self.graph_data:
            self.graph_data['nodes'] = []
        self._set_id(node)
        self.graph_data['nodes'].append(node)


    def _create_node(self, graph, template: str):
        """
        Creates a node of the specified type from existing node definitions.
        """
        if template in Node._templates:
            node = copy.deepcopy(Node._templates[template])
            self._set_id(node)
            if graph:
                nodes = copy.deepcopy(node['nodes'])
                node['nodes'] = []
                graph['nodes'].append(node)
                for child_node in nodes:
                    self._create_node(node, child_node['type'])
            return node
        raise ValueError(f"Node type '{template}' not found in node definitions.")

    def create_node(self, template: str, target_graph=None):
        """
        Creates a node and adds it to the specified graph or main graph.
        """
        if target_graph is None:
            target_graph = self.graph_data
        return self._create_node(target_graph, template)

    def create_external_node(self, file_path):
        """
        Loads a graph from an external YAML file and adds it to this graph.
        Args:
            file_path (str): The path to the YAML file containing the graph definition.
        Returns:
            dict: The loaded graph.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Graph file '{file_path}' does not exist.")

        with open(file_path, 'r') as f:
            external_graph = yaml.safe_load(f)
            self.add_node_to_graph(external_graph)

    def generate_unique_pin_name(self, node, pin_name):
        """
        Generates a unique name for a pin based on the node type and pin name.
        This is useful for ensuring that pin names do not collide in the generated shader code.
        """
        if 'id' not in node or node['id'] == -1:
            raise ValueError("Node ID is not set in the graph. Please set a unique ID for the node.")
        return f"{node['type']}_{node['id']}_{pin_name}"


    def get_node(self, id):
        print(f"Searching in graph '{self.graph_data['name']}' for node id '{id}'")
        return self.graph_data['nodes'][id]

    def get_node_by_type(self, type):
        if self.graph_data and 'type' in self.graph_data:
            print(f"Searching in graph {self.graph_data['type']} for node type '{type}'")
        result = [node for node in self.graph_data['nodes'] if node['type'] == type]
        if result:
            return result[0]

    def get_node_by_name(self, name):
        if self.graph_data and 'type' in self.graph_data:
            print(f"Searching in graph {self.graph_data['type']} for node name '{name}'")
        result = [node for node in self.graph_data['nodes'] if node['name'] == name]
        if result:
            return result[0]

    def find_nested_node_by_type(self, parent_node, node_type):
        """
        Find a node by type within a specific parent node
        """
        if 'nodes' not in parent_node:
            return None
        result = [node for node in parent_node['nodes'] if node['type'] == node_type]
        return result[0] if result else None

    def find_nested_node_by_name(self, parent_node, node_name):
        """
        Find a node by name within a specific parent node
        """
        if 'nodes' not in parent_node:
            return None
        result = [node for node in parent_node['nodes'] if node['name'] == node_name]
        return result[0] if result else None

    def get_node_local_path(self, target_node):
        """
        Finds the path of a node within the graph hierarchy.
        The path is represented as a string like '/id1/id2/...'.
        """
        return f'{self.graph_data["id"]}/{target_node["id"]}'

    def get_input(self, node, id):
        input = [input for input in node['inputs'] if input['id'] == id]
        if not input:
            raise ValueError(f"Input with id '{id}' not found in node '{node['type']}'")
        return input[0]

    def get_output(self, node, id):
        output = [output for output in node['outputs'] if output['id'] == id]
        if not output:
            raise ValueError(f"Output with id '{id}' not found in node '{node['type']}'")
        return output[0]

    def connect_nodes(self, from_node, to_node, from_pin, to_pin):
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
        output['value'] = f'{"../"}{to_node["id"]}/{input["id"]}'
        input['value'] = f'{"../"}{from_node["id"]}/{output["id"]}'

    def add_meta(self, value):
        """
        Adds a meta value to the graph.
        If the meta dictionary does not exist, it creates one.
        """
        if 'meta' not in self.graph_data:
            self.graph_data['meta'] = []
        self.graph_data['meta'].append(value)

    def to_dict(self):
        """Returns the graph data as a dictionary"""
        return self.graph_data