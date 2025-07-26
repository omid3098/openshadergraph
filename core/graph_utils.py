import yaml


import copy
import os


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
            node = copy.deepcopy(self.templates[template])
            self.set_id(node)
            if graph:
                nodes = copy.deepcopy(node['nodes'])
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

    def get_node_by_type(self, graph, type):
        if graph and 'type' in graph:
            print(f"Searching in graph {graph['type']} for node name '{type}'")
        result = [node for node in graph['nodes'] if node['type'] == type]
        if result:
            return result[0]

    def get_node_local_path(self, graph_node, target_node):
        """
        Finds the path of a node within the graph hierarchy.
        The path is represented as a string like '/id1/id2/...'.
        """
        return f'{graph_node["id"]}/{target_node["id"]}'

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

    def connect_nodes(self, from_node, to_node, from_pin, to_pin):
        # TODO: check pin types before connecting and raise an error if they are not compatible
        input = self.get_input(to_node, to_pin)
        output = self.get_output(from_node, from_pin)
        output['value'] = f'{"../"}{to_node["id"]}/{input["id"]}'
        input['value'] = f'{"../"}{from_node["id"]}/{output["id"]}'

    def add_meta(self, graph, value):
        """
        Adds a meta key-value pair to the graph.
        If the meta dictionary does not exist, it creates one.
        """
        if 'meta' not in graph:
            graph['meta'] = []
        graph['meta'].append(value)