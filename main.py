import os
import yaml


# --- Predefined Variables ---
SHADER_NAME = "BasicShader"
SHADER_TYPE = "surface"
LANGUAGE = "Godot"
nodes_root_path = ""


def load_node(node_name: str):
    # find the node yml file from nodes_root_path
    # loop recursively through the nodes_root_path
    for root, dirs, files in os.walk(nodes_root_path):
        for file in files:
            if file == f"{node_name}.yml":
                # return the content of the yml file
                with open(os.path.join(root, file), 'r') as f:
                    return yaml.safe_load(f)

def get_node_template(node_type: str, language_template: str):
    for node_name, node_data in language_template['nodes'].items():
        if node_name == node_type:
            return node_data['template']
    raise ValueError(f"Node type '{node_type}' not found in language template.")

def generate_unique_node_name(node):
    if node['id'] == -1:
        raise ValueError("Node ID is not set in the graph. Please set a unique ID for the node.")
    return f"{node['type']}_{node['id']}"

def generate_shader(graph, language: str):
    # Find the language template
    language_template_path = os.path.join("data", "languages", f"{language}.yml")
    if not os.path.exists(language_template_path):
        raise FileNotFoundError(f"Language definition file not found at '{language_template_path}'")
    with open(language_template_path, 'r') as f:
        language_template = yaml.safe_load(f)
    code_template = language_template['code_template']

    # Set shader type in the code template
    shader_type = get_node_template(graph['type'], language_template)
    code_template = code_template.replace("{{shader_type}}", shader_type)

    # Set uniforms in the code template
    # TODO: Make this recursive using a local function to handle nested nodes
    uniforms = []
    for node in graph['nodes']:
        if node.startswith("/"):
            # this is a relative path to a node
            node_name = node.split("/")[-1]
            node_data = load_node(node_name)
        else:
            # this is a direct node name
            node_data = node
        if "uniform" in node_data['meta']:
            uniform_type = get_node_template(node_data['type'], language_template)
            uniform_name = generate_unique_node_name(node_data)
            uniforms.append(f"uniform {uniform_type} {uniform_name};\n")
    code_template = code_template.replace("{{uniforms}}", "".join(uniforms))

    # Set Varyings in the code template
    # TODO: use the same function as uniforms
    varyings = []
    for node in graph['nodes']:
        if node.startswith("/"):
            # this is a relative path to a node
            node_name = node.split("/")[-1]
            node_data = load_node(node_name)
        else:
            # this is a direct node name
            node_data = node
        if "varying" in node_data['meta']:
            varying_type = get_node_template(node_data['type'], language_template)
            varying_name = generate_unique_node_name(node_data)
            varyings.append(f"varying {varying_type} {varying_name};\n")

    code_template = code_template.replace("{{varyings}}", "".join(varyings))

    # Set vertex and fragment passes

    print(f"{code_template}")


# --- Main Execution ---
if __name__ == "__main__":
    print("---------------------- Shader Generation Script ---------------------")
    print(f"Generating a graph for shader '{SHADER_NAME}' of type '{SHADER_TYPE}'...")

    data_root_path = "data"
    nodes_root_path = os.path.join(data_root_path, "nodes")

    surface_graph = load_node("surface")
    print("------------------------ Loaded Surface Graph -----------------------")
    print(yaml.dump(surface_graph, default_flow_style=False, sort_keys=False))

    print("------------------------ Generating Shader Code -----------------------")
    shader_code = generate_shader(surface_graph, LANGUAGE)

