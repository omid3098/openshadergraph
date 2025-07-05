
import yaml
import os

# --- Predefined Variables ---
SHADER_NAME = "TestShader"
SHADER_TYPE = "surface"
LANGUAGE = "Godot"

# --- Graph Creation Logic ---
def create_graph_data(shader_type, shader_name):
    """Loads a shader template and returns it as a Python dictionary."""
    template_path = os.path.join("data", "shader_templates", f"{shader_type.capitalize()}.yml")
    if not os.path.exists(template_path):
        raise FileNotFoundError(f"Shader template not found at '{template_path}'")

    with open(template_path, 'r') as f:
        graph_data = yaml.safe_load(f)

    graph_data['name'] = shader_name
    return graph_data

# --- Shader Generation Logic ---
def generate_shader_code(graph_data, language_data):
    """Generates shader code from graph and language data."""
    shader_type = graph_data.get('type', 'spatial').lower()
    code_template = language_data.get('code_template', '')

    # In the future, this section will perform a topological sort and generate code.
    # For now, it uses empty placeholders.
    uniforms_code = "// No uniforms defined"
    varyings_code = "// No varyings defined"
    vertex_code = "// Vertex stage is empty"
    fragment_code = "// Fragment stage is empty"

    # Replace placeholders
    final_shader = code_template.replace("{{shader_type}}", shader_type)
    final_shader = final_shader.replace("{{uniforms}}", uniforms_code)
    final_shader = final_shader.replace("{{varyings}}", varyings_code)
    final_shader = final_shader.replace("{{vertex_code}}", vertex_code)
    final_shader = final_shader.replace("{{fragment_code}}", fragment_code)

    return final_shader

# --- Main Execution ---
if __name__ == "__main__":
    print(f"Generating shader '{SHADER_NAME}' of type '{SHADER_TYPE}'...")

    # 1. Find and load the language definition
    language_file_path = os.path.join("data", "languages", f"{LANGUAGE}.yml")
    if not os.path.exists(language_file_path):
        raise FileNotFoundError(f"Language file not found for '{LANGUAGE}' at '{language_file_path}'")
    with open(language_file_path, 'r') as f:
        lang_data = yaml.safe_load(f)

    # 2. Create graph data in memory
    graph_data = create_graph_data(SHADER_TYPE, SHADER_NAME)

    # 3. Generate shader code from graph data
    shader_code = generate_shader_code(graph_data, lang_data)

    # 4. Write output files
    # Get file extension from language data
    file_extension = lang_data.get('file_extensions', ['.txt'])[0]

    # Write the graph YAML file
    graph_filename = f"{SHADER_NAME}.yml"
    with open(graph_filename, 'w') as f:
        yaml.dump(graph_data, f, sort_keys=False)
    print(f"Successfully wrote graph file: {graph_filename}")

    # Write the final shader code file
    shader_filename = f"{SHADER_NAME}.{file_extension}"
    with open(shader_filename, 'w') as f:
        f.write(shader_code)
    print(f"Successfully wrote shader file: {shader_filename}")
