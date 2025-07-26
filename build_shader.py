import yaml
import os

from core.graph_compiler import GraphCompiler

LANGUAGES = ['Godot']


def load_yaml_file(file_path):
    '''Load a YAML file and return its contents.'''
    if not os.path.exists(file_path):
        raise FileNotFoundError(f'File not found: {file_path}')
    with open(file_path, 'r') as f:
        return yaml.safe_load(f)


def build(shader_name):
    graph_path = os.path.join('', f'{shader_name}.yml')
    graph_data = load_yaml_file(graph_path)

    for language in ['Godot']:
        lang_def_path = os.path.join('data', 'languages', f'{language}.yml')
        lang_def = load_yaml_file(lang_def_path)

        generator = GraphCompiler(graph_data, lang_def)
        generator.compile()

        ext = lang_def['file_extensions'][0]
        output_file = f'{shader_name}.{ext}'
        with open(output_file, 'w') as f:
            f.write(generator.result_code)