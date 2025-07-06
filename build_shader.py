
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

def clean_for_yaml(data):
    """Recursively remove empty lists, empty dictionaries, empty strings, and None values."""
    if isinstance(data, dict):
        cleaned_dict = {}
        for k, v in data.items():
            cleaned_v = clean_for_yaml(v)
            if cleaned_v not in (None, '', [], {}):
                cleaned_dict[k] = cleaned_v
        return cleaned_dict
    elif isinstance(data, list):
        cleaned_list = []
        for item in data:
            cleaned_item = clean_for_yaml(item)
            if cleaned_item not in (None, '', [], {}):
                cleaned_list.append(cleaned_item)
        return cleaned_list
    else:
        return data

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
    # Load the language definition file
    language_path = os.path.join("data", "languages", f"{language}.yml")
    if not os.path.exists(language_path):
        raise FileNotFoundError(f"Language definition file not found at '{language_path}'")
    
    with open(language_path, 'r') as f:
        lang_def = yaml.safe_load(f)

    generator = ShaderGenerator(graph_data, lang_def)
    return generator.generate()

class ShaderGenerator:
    def __init__(self, graph_data, lang_def):
        self.graph_data = graph_data
        self.lang_def = lang_def
        self.generated_code = {
            "vertex": [],
            "fragment": []
        }
        self.variable_map = {}

    def generate(self):
        # Find and process vertex and fragment passes
        for node in self.graph_data['nodes']:
            if node['type'] == 'vertex_pass':
                self.process_pass(node, 'vertex')
            elif node['type'] == 'fragment_pass':
                self.process_pass(node, 'fragment')

        # Assemble the final shader code from the template
        return self.assemble_shader()

    def process_pass(self, pass_node, pass_type):
        # Process all nodes within this pass
        for node in pass_node['nodes']:
            self.process_node(node, pass_type, pass_node)

    def process_node(self, node, pass_type, pass_node):
        node_type = node['type']
        if node_type not in self.lang_def['nodes']:
            print(f"Warning: No language definition for node type '{node_type}'")
            return

        node_def = self.lang_def['nodes'][node_type]
        
        # 1. Resolve input values
        resolved_inputs = {}
        for pin in node['inputs']:
            resolved_inputs[pin['name']] = self.resolve_input_value(pin['value'])

        # 2. Create a unique variable name for the node's output
        var_name = f"{node['title']}_{node['id']}"
        
        # 3. Generate the code snippet for the current node
        code_snippet = node_def['template'].replace('{{var_name}}', var_name)
        for pin_name, pin_value in resolved_inputs.items():
            code_snippet = code_snippet.replace(f"{{{{inputs.{pin_name}}}}}", str(pin_value))
        
        self.generated_code[pass_type].append(code_snippet)

        # 4. Map the output pins to the generated variable name
        if 'outputs' in node_def:
            for pin_name, out_var_template in node_def['outputs'].items():
                output_var_name = out_var_template.replace('{{var_name}}', var_name)
                self.variable_map[f"/{pass_node['id']}/{node['id']}/{pin_name}"] = output_var_name

    def resolve_input_value(self, value):
        if isinstance(value, str) and value.startswith('/'):
            # This is a connection path, look it up in the variable map
            return self.variable_map.get(value, "/* unresolved connection */")
        elif isinstance(value, list):
            # It's a vector or color literal, format it for the shader language
            return f"vec4({', '.join(map(str, value))})"
        else:
            # It's a direct scalar value
            return value

    def assemble_shader(self):
        # Replace placeholders in the master template
        template = self.lang_def['code_template']
        shader_code = template.replace('{{graph_type}}', self.graph_data['type'])
        shader_code = shader_code.replace('{{uniforms}}', "") # Placeholder for now
        shader_code = shader_code.replace('{{varyings}}', "") # Placeholder for now
        shader_code = shader_code.replace('{{vertex_code}}', "\n    ".join(self.generated_code['vertex']))
        shader_code = shader_code.replace('{{fragment_code}}', "\n    ".join(self.generated_code['fragment']))
        return shader_code


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
    
    # Clean the graph data before saving
    cleaned_graph_data = clean_for_yaml(graph_data)

    # Save the yaml file
    output_path = os.path.join("", SHADER_NAME + ".yml")
    with open(output_path, 'w') as f:
        yaml.dump(cleaned_graph_data, f, default_flow_style=False, sort_keys=False)

    # Generate the shader code
    shader_code = generate_shader_code(graph_data, LANGUAGE)
    print("\n--- Generated Shader Code ---")
    print(shader_code)
    print("---------------------------\n")

    # Save the shader code to a file
    shader_filename = f"{SHADER_NAME}.gdshader"
    with open(shader_filename, 'w') as f:
        f.write(shader_code)
    print(f"Shader code saved to '{shader_filename}'")

