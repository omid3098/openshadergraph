import os
import yaml

from utils import *


# --- Predefined Variables ---
SHADER_NAME = "BasicShader"
SHADER_TYPE = "surface"
LANGUAGE = "Godot"

def generate_section_code(graph, section_name: str, language_template: dict):
    code_lines = []

    def recursive_processor(nodes):
        for node in nodes:
            node_data = get_node_data(node)
            if 'meta' in node_data and f"{section_name}" in node_data['meta']:
                param_type = get_node_template(node_data['type'], language_template)
                param_name = generate_unique_node_name(node_data)
                code_lines.append(f"{section_name} {param_type} {param_name};\n")
            
            if 'nodes' in node_data and node_data['nodes']:
                recursive_processor(node_data['nodes'])

    recursive_processor(graph['nodes'])
    return "".join(code_lines)

def get_node_by_id(graph, node_id):
    for node in graph['nodes']:
        if node['id'] == node_id:
            return node
    return None

def generate_pass_code(pass_node, language_template):
    pass_code = []
    for node in pass_node['nodes']:
        node_data = get_node_data(node)
        template = get_node_template(node_data['type'], language_template)
        
        # Replace placeholders in the template
        var_name = generate_unique_node_name(node_data)
        template = template.replace("{{var_name}}", var_name)
        
        for input_pin in node_data.get('inputs', []):
            value = input_pin['value']
            if isinstance(value, str) and value.startswith('/'):
                # This is a connection
                parts = value.split('/')
                from_node_id = int(parts[2])
                from_node = get_node_by_id(pass_node, from_node_id)
                from_node_var_name = generate_unique_node_name(from_node)
                template = template.replace(f"{{{{inputs.{input_pin['name']}}}}}", from_node_var_name)
            else:
                # This is a literal value
                if isinstance(value, list):
                    value = f"vec4({', '.join(map(str, value))})"
                template = template.replace(f"{{{{inputs.{input_pin['name']}}}}}", str(value))
            
        pass_code.append(template)
        
    return "\n".join(pass_code)

def generate_shader(graph, language: str):
    # Find the language template
    language_template_path = os.path.join("data", "languages", f"{language}.yml")
    if not os.path.exists(language_template_path):
        raise FileNotFoundError(f"Language definition file not found at '{language_template_path}'")
    with open(language_template_path, 'r') as f:
        language_template = yaml.safe_load(f)
    node_templates = language_template['nodes']

    # find output nodes in the graph to traverse backwards
    output_nodes = find_output_nodes(graph)

    for output_node in output_nodes:
        # Generate code for the output node by traversing the graph
        output_code = generate_output_code(graph, output_node, language_template)


    # # Set shader type in the code template
    # shader_type = get_node_template(graph['type'], language_template)
    # code_template = code_template.replace("{{shader_type}}", shader_type)

    # # Set uniforms in the code template
    # uniforms_code = generate_section_code(graph, "uniform", language_template)
    # code_template = code_template.replace("{{uniforms}}", uniforms_code)

    # # Set Varyings in the code template
    # varyings_code = generate_section_code(graph, "varying", language_template)
    # code_template = code_template.replace("{{varyings}}", varyings_code)

    # # Set vertex and fragment passes
    # vertex_pass_node = get_node_from_graph(graph, 'vertex_pass')
    # vertex_code = generate_pass_code(vertex_pass_node, language_template)
    # code_template = code_template.replace("{{vertex_code}}", vertex_code)

    # fragment_pass_node = get_node_from_graph(graph, 'fragment_pass')
    # fragment_code = generate_pass_code(fragment_pass_node, language_template)
    # code_template = code_template.replace("{{fragment_code}}", fragment_code)

    # print(f"{code_template}")


# --- Main Execution ---
if __name__ == "__main__":
    print("---------------------- Shader Generation Script ---------------------")
    print(f"Generating a graph for shader '{SHADER_NAME}' of type '{SHADER_TYPE}'...")

    surface_graph = create_graph_of_type("surface")
    
    # Add color node to the fragment pass
    color_node = create_node_of_type('color') 
    fragment_pass_node = get_node_from_graph(surface_graph, 'fragment_pass')
    add_node_to_graph(fragment_pass_node, color_node)

    # Connect color node to fragment output
    fragment_output_node = get_node_from_graph(fragment_pass_node, 'fragment_output')
    connect_nodes(graph=fragment_pass_node, from_node=color_node, to_node=fragment_output_node, from_pin='out', to_pin='Color')

    # print("------------------------ Loaded Surface Graph -----------------------")
    # print(yaml.dump(surface_graph, default_flow_style=False, sort_keys=False))

    # save it as SHADER_NAME.yml in the project root directory
    shader_file_path = os.path.join(os.getcwd(), f"{SHADER_NAME}.yml")
    with open(shader_file_path, 'w') as f:
        yaml.dump(surface_graph, f, default_flow_style=False, sort_keys=False)

    # print("------------------------ Generating Shader Code -----------------------")
    # shader_code = generate_shader(surface_graph, LANGUAGE)

