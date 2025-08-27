
import re
from pprint import pprint


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

    def _dim(self, type_name):
        """Return dimension of a float vector type."""
        if not type_name:
            return 0
        if type_name == 'float':
            return 1
        m = re.match(r"float(\d)", str(type_name))
        return int(m.group(1)) if m else 0

    def convert_type(self, value, src_type, dst_type):
        """Convert value from src_type to dst_type when possible."""
        if not src_type or not dst_type or src_type == dst_type:
            return value

        src_dim = self._dim(src_type)
        dst_dim = self._dim(dst_type)
        if src_dim and dst_dim:
            comps = 'rgba'
            if src_dim > dst_dim:
                return f"{value}.{comps[:dst_dim]}"
            if src_dim < dst_dim:
                if src_dim == 1:
                    return f"vec{dst_dim}({value})"
                extras = ["1.0" if i == 3 else "0.0" for i in range(src_dim, dst_dim)]
                extra = ', '.join(extras)
                return f"vec{dst_dim}({value}, {extra})" if extra else f"vec{dst_dim}({value})"
        return value

    def get_resolved_output_type(self, node):
        """Infer a node's output type based on its connected inputs."""
        types = []
        for inp in node.get('inputs', []):
            t = inp.get('_resolved_type') or inp.get('type')
            if isinstance(t, list):
                continue
            types.append(self._dim(t))
        if types:
            dim = max(types)
            return 'float' if dim == 1 else f'float{dim}'
        return 'float'

    def resolve_ref(self, node, input):
        log([f"resolve_ref {node['type']} {input}"], False)
        path = input['value'].split('/')
        ref_node = node
        for p in path:
            if p == '..':
                ref_node = ref_node['parent']

        ref_node = self.get_node(ref_node, path[-2])
        ref_node['_resolving_input'] = True
        ref_node['_input_parent'] = node
        self.process_node(ref_node)
        ref_node.pop('_input_parent', None)
        ref_node['_code_used'] = True

        output_id = int(path[-1])
        ref_type = None
        for out in ref_node.get('outputs', []):
            if out['id'] == output_id:
                ref_type = out.get('type')
                break
        if isinstance(ref_type, list):
            ref_type = self.get_resolved_output_type(ref_node)

        dst_type = input.get('type')
        if isinstance(dst_type, list):
            dst_type = ref_type

        value = self.get_unique_node_name(ref_node)
        input['value'] = self.convert_type(value, ref_type, dst_type)
        input['_resolved_type'] = ref_type
        # input['value'] = ref_node['value']
        # todo: need to reconsider ref values
        # value: ../1/out
        # the out output does not have enough values
        # if probably should be ../1 for single output functions

    def resolve_template_input(self, node, match, index):
        log([f'resolve_template_input {node["type"]} {match} {index}'], False)
        input = node['inputs'][index]
        if 'value' not in input:
            node['_code'] = node['_code'].replace(match, '')
            return
        if isinstance(input['value'], str) and '../' in input['value']:
            self.resolve_ref(node, input)
        input['_code'] = self.resolve_type(input['value'])
        node['_code'] = node['_code'].replace(match, node['inputs'][index]['_code'])

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
            self.resolve_template_input(node, match, input_index)

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
                    if child_node.get('_code_used'):
                        continue
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

        # Special-case nodes that may have optional inputs
        if node['type'] == 'vertex_output':
            inp = node['inputs'][0] if node.get('inputs') else None
            if not inp or 'value' not in inp:
                node['_code'] = ''
                return
            if isinstance(inp['value'], str) and '../' in inp['value']:
                self.resolve_ref(node, inp)
            expr = self.resolve_type(inp['value'])
            code = f"COLOR = {expr};"
            if '_input_code' in node:
                code = node['_input_code'].rstrip() + '\n' + code
            node['_code'] = code
            return

        if node['type'] == 'fragment_output':
            lines = []
            mapping = [
                ('ALBEDO', 0, 'vec3({})'),
                ('ROUGHNESS', 1, '{}'),
                ('METALLIC', 2, '{}'),
                ('EMISSION', 3, 'vec3({})'),
                ('NORMAL', 4, 'vec3({})'),
                ('ALPHA', 5, '{}'),
            ]
            for name, idx, fmt in mapping:
                if idx >= len(node.get('inputs', [])):
                    continue
                inp = node['inputs'][idx]
                if 'value' not in inp:
                    continue
                if isinstance(inp['value'], str) and '../' in inp['value']:
                    self.resolve_ref(node, inp)
                expr = self.resolve_type(inp['value'])
                lines.append(f"{name} = {fmt.format(expr)};")
            if '_input_code' in node:
                lines.insert(0, node['_input_code'].rstrip())
            node['_code'] = '\n\t'.join(lines)
            return

        code = self.resolve_internals(node)
        if code:
            log([f'adding code {node["type"]}', code])
            if '_resolving_input' in node:
                parent = node.get('_input_parent', node['parent'])
                if code:
                    if '_input_code' not in parent:
                        parent['_input_code'] = ''
                    parent['_input_code'] += f'\t{code}\n'
                del node['_resolving_input']
                node['_code'] = code
                node['_code_used'] = True
                node.pop('_input_parent', None)
            else:
                node['_code'] = code

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
        return self.lang_def['meta'][meta]['template']

    def add_meta(self):
        meta_code = ''
        for meta in self.graph_data['meta']:
            meta_code += f'{self.get_meta_template(meta)}\n'
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
        self.process_node(self.graph_data)
        self.result_code = self.graph_data.get('_code', '')
        self.add_meta()
        exposed = []
        self.collect_exposed_nodes(self.graph_data, exposed)
        exposed_code = ''
        if exposed:
            exposed_code = '\n'.join(exposed) + '\n'
        self.result_code = self.result_code.replace(r'{{exposed_nodes}}', exposed_code)
        self.result_code = self.result_code.replace(r'{{internal_nodes}}', '')

        log(['GENERATED SHADER:', self.result_code])