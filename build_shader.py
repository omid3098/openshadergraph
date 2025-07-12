import yaml
import os
from toposort import toposort_flatten

# Predefined Variables
SHADER_NAME = "BasicShader"
SHADER_TYPE = "surface"
LANGUAGES = ["Godot", "Unity"]

def load_yaml_file(file_path):
    """Load a YAML file and return its contents."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    with open(file_path, 'r') as f:
        return yaml.safe_load(f)

class ShaderGenerator:
    def __init__(self, graph_data, lang_def):
        self.graph_data = graph_data
        self.lang_def = lang_def
        self.global_variable_map = {}  # Maps full paths to variable names

    def generate(self):
        """Generate shader code for the entire graph."""
        if self.graph_data['type'] not in self.lang_def['nodes']:
            raise ValueError(f"Language '{self.lang_def['name']}' does not support shader type '{self.graph_data['type']}'")
        return self.process_node(self.graph_data, [], {})

    def process_node(self, node, path_prefix, local_variable_map):
        """Process a node recursively, generating its shader code."""
        node_type = node['type']
        node_id = node.get('id', -1)
        
        if node_type not in self.lang_def['nodes']:
            raise ValueError(f"No template for node type '{node_type}'")

        template = self.lang_def['nodes'][node_type]['template']
        
        # Build a dictionary of replacements
        replacements = {}

        # Process metadata into "meta.key" format
        meta_values = self.get_meta_replacements(node.get('meta', []))
        for key, value in meta_values.items():
            replacements[f"meta.{key}"] = value

        # Process other simple fields from the node
        for key, value in node.items():
            if isinstance(value, (str, int, float)):
                replacements[key] = str(value)
        
        # Apply all replacements
        for key, value in replacements.items():
            template = template.replace(f"{{{{{key}}}}}", value)

        # Process nested nodes if present
        if "{{internal_nodes}}" in template:
            internal_code = ""
            if node.get('nodes'):
                internal_code = self.process_subgraph(node, path_prefix + [node_id])
            template = template.replace("{{internal_nodes}}", internal_code)

        # Handle outputs for var_name replacement
        if 'outputs' in node:
            for output in node['outputs']:
                var_name = self.generate_unique_var_name(node_type, node_id, output['name'])
                template = template.replace("{{var_name}}", var_name)

        # Handle inputs
        for input_pin in node.get('inputs', []):
            value = self.resolve_input_value(input_pin['value'], local_variable_map, "")
            template = template.replace(f"{{{{inputs.{input_pin['name']}}}}}", value)

        return template

    def process_subgraph(self, subgraph_node, path_prefix):
        """Process a subgraph, handling dependencies with topological sorting."""
        child_nodes_raw = subgraph_node.get('nodes', [])
        
        child_nodes = []
        for node_ref in child_nodes_raw:
            if isinstance(node_ref, str):
                node_path = os.path.join("data", "nodes", f"{node_ref.strip('/')}.yml")
                node_data = load_yaml_file(node_path)
                child_nodes.append(node_data)
            else:
                child_nodes.append(node_ref)

        dependencies = {node['id']: set() for node in child_nodes}
        node_map = {node['id']: node for node in child_nodes}

        for node in child_nodes:
            for input_pin in node.get('inputs', []):
                value = input_pin['value']
                if isinstance(value, str) and value.startswith('/'):
                    try:
                        dep_id = int(value.split('/')[1])
                        if dep_id in node_map:
                            dependencies[node['id']].add(dep_id)
                    except (ValueError, IndexError):
                        continue

        try:
            sorted_ids = toposort_flatten(dependencies)
        except ValueError:
            raise ValueError("Cycle detected in node dependencies")

        code_lines = []
        local_variable_map = {}
        for node_id in sorted_ids:
            if node_id not in node_map:
                continue
            node = node_map[node_id]
            node_code = self.process_node(node, path_prefix + [subgraph_node['id']], local_variable_map)
            code_lines.append(node_code)
            
            if 'outputs' in node:
                for output in node['outputs']:
                    var_name = self.generate_unique_var_name(node['type'], node_id, output['name'])
                    local_variable_map[f"/{node_id}/{output['name']}"] = var_name

        return "\n    ".join(filter(None, code_lines))

    def resolve_input_value(self, value, local_variable_map, current_path):
        """Resolve the value of an input pin (literal or connection)."""
        if isinstance(value, str) and value.startswith('/'):
            return local_variable_map.get(value, "/* unresolved */")
        elif isinstance(value, list):
            return ', '.join(map(str, value))
        return str(value)

    def generate_unique_var_name(self, node_type, node_id, pin_name):
        """Generate a unique variable name for an output pin."""
        return f"{node_type}_{node_id}_{pin_name}"

    def get_meta_replacements(self, meta):
        """Process metadata and return replacements for the template."""
        replacements = {
            "blend_mode": ""
        }
        for item in meta:
            for key, value in item.items():
                if key == "blend_mode" and value == "transparent":
                    if self.lang_def['name'] == "Godot Shader Language":
                        replacements["blend_mode"] = "render_mode blend_add;\n"
                    elif self.lang_def['name'] == "Unity HLSL":
                        replacements["blend_mode"] = 'Tags { "Queue" = "Transparent" }\n        Blend SrcAlpha OneMinusSrcAlpha\n'
        return replacements


if __name__ == "__main__":
    graph_path = os.path.join("", f"{SHADER_NAME}.yml")
    graph_data = load_yaml_file(graph_path)
    
    for language in LANGUAGES:
        print(f"\nGenerating {language} shader for '{SHADER_NAME}'...")
        
        lang_def_path = os.path.join("data", "languages", f"{language}.yml")
        lang_def = load_yaml_file(lang_def_path)
        
        generator = ShaderGenerator(graph_data, lang_def)
        shader_code = generator.generate()
        
        ext = lang_def['file_extensions'][0]
        output_file = f"{SHADER_NAME}.{ext}"
        with open(output_file, 'w') as f:
            f.write(shader_code)
        print(f"Shader saved to '{output_file}':\n{shader_code}\n")