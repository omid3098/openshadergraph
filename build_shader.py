import yaml
import os
from pprint import pprint
import re

# Predefined Variables
SHADER_NAME = 'BasicShader'
LANGUAGES = ['Godot', 'Unity']


def load_yaml_file(file_path):
    '''Load a YAML file and return its contents.'''
    if not os.path.exists(file_path):
        raise FileNotFoundError(f'File not found: {file_path}')
    with open(file_path, 'r') as f:
        return yaml.safe_load(f)


def log(logs, separated=True):
    if separated:
        print('-------------------------------------------')
    [print(e) for e in logs]


class ShaderGenerator:
    def __init__(self, graph_data, lang_def):
        self.graph_data = graph_data
        self.lang_def = lang_def
        self.shader_code = ''

    def has_nodes(self, node):
        has_nodes = 'nodes' in node and len(node['nodes']) > 0
        return has_nodes

    def has_code(self, node):
        has_nodes = '_code' in node and len(node['_code']) > 0
        return has_nodes

    def get_node(self, parent, id):
        for node in parent['nodes']:
            if node['id'] == int(id):
                return node
    
    def get_node_name(self, node):
        return node['name'] if 'name' in node else node['title']
    
    def get_output(self, node, name):
        for output in node['outputs']:
            if output['name'] == name:
                return output

    def resolve_type(self, value):
        if isinstance(value, list):
            return re.sub(r'[\[\]]', '', str(value))
        return value
        
    def resolve_ref(self, node, input):
        log([f'resolve_ref {node['type']} {input}'], False)
        path = input['value'].split('/')
        ref_node = node
        for p in path:
            if p == '..':
                ref_node = ref_node['parent']
            
        ref_node = self.get_node(ref_node, path[-2])
        self.process_node(ref_node)
        # todo: next line is temporary
        input['value'] = self.get_node_name(ref_node)
        # input['value'] = ref_node['value']
        # todo: need to reconsider ref values
        # value: ../1/out
        # the out output does not have enough values
        # if probably should be ../1 for single output functions

    def resolve_template_input(self, node, match, index):
        log([f'resolve_template_input {node['type']} {match} {index}'], False)
        input = node['inputs'][index]
        if '../' in input['value']:
            self.resolve_ref(node, input)
        input['_code'] = self.resolve_type(input['value'])
        node['_code'] = node['_code'].replace(match, node['inputs'][index]['_code'])

    def resolve_template(self, node):
        log([f'resolve_template {node['type']}'], False)

        if r'{{name}}' in node['_code']:
            node['_code'] = node['_code'].replace(r'{{name}}', self.get_node_name(node))
        if r'{{inputs' in node['_code']:
            # todo: need to set node['inputs_code'] somewhere here,
            # then insert before the template later
            pass
        matches = re.findall(r"(\{\{inputs:(\d+)\}\})", node['_code'])
        for match, input_index in matches:
            input_index = int(input_index)
            node['_resolving_input'] = True
            self.resolve_template_input(node, match, input_index)

    def resolve_internals(self, node):
        node['_code'] = self.get_template(node)
        self.resolve_template(node)
        if r'{{internal_nodes}}' not in node['_code']:
            return node['_code']
        log([f'resolve_internals {node['type']}'], False)

        if not self.has_nodes(node):
            node['_code'] = node['_code'].replace(r'{{internal_nodes}}', '')
        else:
            if '_input_code' in node:
                node['_code'] = node['_code'].replace(r'{{internal_nodes}}', node['_input_code'])
            else:
                internal_code = ''
                for child_node in node['nodes']:
                    internal_code += f'\t{child_node['_code']}\n'
                node['_code'] = node['_code'].replace(r'{{internal_nodes}}', internal_code)
        return node['_code']

    def compile_node(self, node):
        if '_code' in node:
            return
        log([f'compiling {node['type']}'], False)
        code = self.resolve_internals(node)
        if code:
            log([f'adding code {node['type']}', code])
            node['_code'] = code
            if '_resolving_input' in node:
                if '_input_code' not in node['parent']:
                    node['parent']['_input_code'] = ''
                node['parent']['_input_code'] += f'\t{code}\n'
                del node['_resolving_input']
            else:
                self.shader_code += f'{code}\n'

    def get_template(self, node):
        return self.lang_def['nodes'][node['type']]['template']

    
    def process_node(self, node):
        if self.has_code(node):
            return
        log([f'processing {node['type']}'])
        if not self.has_nodes(node):
            self.compile_node(node)
            return
        sorted_nodes = sorted(node['nodes'], key=lambda item: item['id'])
        for child_node in sorted_nodes:
            child_node['parent'] = node
            self.process_node(child_node)
        self.compile_node(child_node)

    def add_meta(self, node):
        # for meta in self.graph_data['meta']:
        pass

    def set_parents(self, node):
        if self.has_nodes(node):
            for child_node in node['nodes']:
                child_node['parent'] = node
                self.set_parents(child_node)

    def generate(self):
        pprint(graph_data)
        self.set_parents(graph_data)
        self.process_node(graph_data)
        log(['GENERATED SHADER:', self.shader_code])

if __name__ == '__main__':
    graph_path = os.path.join('', f'{SHADER_NAME}.yml')
    graph_data = load_yaml_file(graph_path)

    for language in LANGUAGES:
        log([f'\nGenerating {language} shader for {SHADER_NAME}'])

        lang_def_path = os.path.join('data', 'languages', f'{language}.yml')

        lang_def = load_yaml_file(lang_def_path)
        print(f'lang_def {type(lang_def)}')
        generator = ShaderGenerator(graph_data, lang_def)

        generator.generate()

        ext = lang_def['file_extensions'][0]
        output_file = f'{SHADER_NAME}.{ext}'
        with open(output_file, 'w') as f:
            f.write(generator.shader_code)
        break
        # print(f'Shader saved to '{output_file}':\n{shader_code}\n')
