
import re
from pprint import pprint

from .node import Node


def log(logs, separated=True):
    if separated:
        print('-------------------------------------------')
    [print(e) for e in logs]

class GraphCompiler:
    def __init__(self, graph_data, lang_def):
        self.graph_data = graph_data
        self.lang_def = lang_def
        self.result_code = ''

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

    def get_unique_node_name(self, node):
        return f"{node['type']}_{node['id']}" if 'type' in node else f"NO_TYPE_{node['id']}"

    def get_node_name(self, node):
        return node['name'] if 'name' in node else 'NO_NAME'

    def get_output(self, node, name):
        for output in node['outputs']:
            if output['name'] == name:
                return output

    def resolve_type(self, value):
        if isinstance(value, list):
            return re.sub(r'[\[\]]', '', str(value))
        return value

    def convert_type(self, value, from_type, to_type):
        type_order = {"float": 1, "float2": 2, "float3": 3, "float4": 4}

        if isinstance(from_type, list):
            from_type = from_type[0]
        if isinstance(to_type, list):
            to_type = to_type[0]

        if not from_type or not to_type or from_type == to_type:
            return value

        if from_type in type_order and to_type in type_order:
            from_n = type_order[from_type]
            to_n = type_order[to_type]
            if from_n > to_n:
                swizzles = {1: "x", 2: "xy", 3: "xyz", 4: "xyzw"}
                swizzle = swizzles[to_n]
                if from_n == 4 and to_n == 3:
                    swizzle = "rgb"
                if from_n == 4 and to_n == 2:
                    swizzle = "rg"
                return f"{value}.{swizzle}"
            if from_n < to_n:
                return f"vec{to_n}({value})"
        return value

    def resolve_ref(self, node, input):
        log([f"resolve_ref {node['type']} {input}"], False)
        path = input['value'].split('/')
        ref_node = node
        for p in path:
            if p == '..':
                ref_node = ref_node['parent']

        ref_node = self.get_node(ref_node, path[-2])
        self.process_node(ref_node)
        output_pin = [o for o in ref_node['outputs'] if o['id'] == int(path[-1])][0]
        if isinstance(output_pin['type'], list):
            input['_ref_type'] = ref_node.get('_resolved_type', output_pin['type'][0])
        else:
            input['_ref_type'] = output_pin['type']
        # determine variable name based on requested output
        if len(ref_node.get('outputs', [])) == 1:
            input['value'] = self.get_unique_node_name(ref_node)
        else:
            input['value'] = f"{self.get_unique_node_name(ref_node)}_{output_pin['name']}"
        # input['value'] = ref_node['value']
        # todo: need to reconsider ref values
        # value: ../1/out
        # the out output does not have enough values
        # if probably should be ../1 for single output functions

    def resolve_template_input(self, node, match, index):
        log([f'resolve_template_input {node["type"]} {match} {index}'], False)
        input = node['inputs'][index]
        if '../' in input['value']:
            self.resolve_ref(node, input)
        expected_type = input.get('type')
        if isinstance(expected_type, list):
            expected_type = node.get('_resolved_type', input.get('_ref_type', expected_type[0]))
        if '_resolved_type' not in node and isinstance(expected_type, str):
            node['_resolved_type'] = expected_type
        code = self.resolve_type(input['value'])
        if '_ref_type' in input:
            code = self.convert_type(code, input['_ref_type'], expected_type)
        input['_code'] = code
        node['_code'] = node['_code'].replace(match, input['_code'])

    def resolve_template(self, node):
        log([f'resolve_template {node["type"]}'], False)

        if r'{{name}}' in node['_code']:
            node['_code'] = node['_code'].replace(r'{{name}}', self.get_unique_node_name(node))
        if r'{{inputs' in node['_code']:
            # todo: need to set node['inputs_code'] somewhere here,
            # then insert before the template later
            pass
        matches = re.findall(r"(\{\{inputs:(\d+)\}\})", node['_code'])
        for match, input_index in matches:
            input_index = int(input_index)
            node['_resolving_input'] = True
            self.resolve_template_input(node, match, input_index)

        if r'{{type}}' in node['_code']:
            type_map = {
                'float': 'float',
                'float2': 'vec2',
                'float3': 'vec3',
                'float4': 'vec4',
                'matrix2': 'mat2',
                'matrix3': 'mat3',
                'matrix4': 'mat4',
            }
            resolved = type_map.get(node.get('_resolved_type', 'float'), node.get('_resolved_type', 'float'))
            node['_code'] = node['_code'].replace(r'{{type}}', resolved)

        if not node.get('outputs'):
            self.remove_default_inputs(node)

    def remove_default_inputs(self, node):
        """Remove code lines for inputs left at their default values."""
        Node._load_templates()
        template = Node._templates.get(node['type'])
        if not template:
            return

        defaults = {inp['name']: inp['value'] for inp in template.get('inputs', [])}
        lines = node['_code'].split('\n')
        new_lines = []
        for line in lines:
            stripped = line.strip()
            if not stripped:
                new_lines.append(line)
                continue
            prop = stripped.split('=')[0].strip()
            input_pin = next((i for i in node.get('inputs', []) if i['name'] == prop), None)
            default_val = defaults.get(prop)
            if not input_pin or default_val is None:
                new_lines.append(line)
                continue
            value = input_pin['value']
            if isinstance(value, str) and '../' in value:
                new_lines.append(line)
                continue
            if value != default_val:
                new_lines.append(line)
        node['_code'] = '\n'.join(new_lines)

    def resolve_internals(self, node):
        node['_code'] = self.get_template(node)
        self.resolve_template(node)
        if r'{{internal_nodes}}' not in node['_code']:
            return node['_code']
        log([f'resolve_internals {node["type"]}'], False)

        if not self.has_nodes(node):
            node['_code'] = node['_code'].replace(r'{{internal_nodes}}', '')
        else:
            if '_input_code' in node:
                node['_code'] = node['_code'].replace(r'{{internal_nodes}}', node['_input_code'])
            else:
                internal_code = ''
                for child_node in node['nodes']:
                    internal_code += f'\t{child_node["_code"]}\n'
                node['_code'] = node['_code'].replace(r'{{internal_nodes}}', internal_code)
        return node['_code']

    def compile_node(self, node):
        if '_code' in node:
            return
        if 'meta' in node and 'exposed' in node['meta']:
            node['_code'] = ''
            return
        log([f'compiling {node["type"]}'], False)
        code = self.resolve_internals(node)
        if code:
            log([f'adding code {node["type"]}', code])
            node['_code'] = code
            if '_resolving_input' in node:
                if '_input_code' not in node['parent']:
                    node['parent']['_input_code'] = ''
                node['parent']['_input_code'] += f'\t{code}\n'
                del node['_resolving_input']
            else:
                self.result_code += f'{code}\n'

    def get_template(self, node):
        node_type = node['type']
        if node_type not in self.lang_def['nodes'] or 'template' not in self.lang_def['nodes'][node_type]:
            raise KeyError(f'No template found for node type "{node_type}" in language definition.')
        return self.lang_def['nodes'][node_type]['template']


    def process_node(self, node):
        if self.has_code(node):
            return
        log([f'processing {node["type"]}'])
        if not self.has_nodes(node):
            self.compile_node(node)
            return
        sorted_nodes = sorted(node['nodes'], key=lambda item: item['id'])
        for child_node in sorted_nodes:
            child_node['parent'] = node
            self.process_node(child_node)
        self.compile_node(node)

    def get_meta_template(self, meta):
        key = meta if isinstance(meta, str) else meta['type']
        return self.lang_def['meta'][key]['template']

    def add_meta(self):
        meta_code = ''
        for meta in self.graph_data.get('meta', []):
            template = self.get_meta_template(meta)
            if isinstance(meta, dict):
                definition = meta.get('definition', '')
                template = template.replace('{{definition}}', definition)
                template = template.replace('{{definitaion}}', definition)
                meta_code += f'{template}\n'
            else:
                meta_code += f'{template}\n'
        self.result_code = self.result_code.replace(r'{{meta}}', meta_code)

    def set_parents(self, node):
        if self.has_nodes(node):
            for child_node in node['nodes']:
                child_node['parent'] = node
                self.set_parents(child_node)

    def collect_exposed_nodes(self, node, exposed):
        if 'meta' in node and 'exposed' in node['meta']:
            code = self.lang_def['nodes'][node['type']]['template']
            code = code.replace('{{name}}', self.get_unique_node_name(node))
            for i, inp in enumerate(node.get('inputs', [])):
                val = self.resolve_type(inp['value'])
                code = code.replace(f'{{{{inputs:{i}}}}}', val)
            template = self.lang_def['meta']['exposed']['template']
            exposed.append(template.replace('{{definition}}', code))
        if self.has_nodes(node):
            for child in node['nodes']:
                self.collect_exposed_nodes(child, exposed)

    def compile(self):
        pprint(self.graph_data)

        self.set_parents(self.graph_data)
        self.result_code = self.get_template(self.graph_data)
        self.process_node(self.graph_data)
        self.add_meta()
        exposed = []
        self.collect_exposed_nodes(self.graph_data, exposed)
        exposed_code = ''
        if exposed:
            exposed_code = '\n'.join(exposed) + '\n'
        self.result_code = self.result_code.replace(r'{{exposed_nodes}}', exposed_code)
        self.result_code = self.result_code.replace(r'{{internal_nodes}}', '')

        log(['GENERATED SHADER:', self.result_code])