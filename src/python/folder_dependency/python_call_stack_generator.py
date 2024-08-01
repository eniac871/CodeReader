import ast
import os
import json
import argparse

def parse_code_to_ast(path):
    with open(path, 'r', encoding='utf-8') as file:
        code = file.read()
    
    ast_tree = ast.parse(code)
    
    def ast_to_dict(node):
        if isinstance(node, ast.AST):
            result = {'_type': node.__class__.__name__}
            for field, value in ast.iter_fields(node):
                result[field] = ast_to_dict(value)
            if hasattr(node, 'lineno'):
                result['lineno'] = node.lineno
            return result
        elif isinstance(node, list):
            return [ast_to_dict(elem) for elem in node]
        else:
            return node

    ast_dict = ast_to_dict(ast_tree)
    return ast_dict

def convert_to_serializable(obj):
    if isinstance(obj, dict):
        return {k: convert_to_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_to_serializable(i) for i in obj]
    elif isinstance(obj, bytes):
        return obj.decode('utf-8')  # or another appropriate encoding
    elif obj is Ellipsis:
        return '...'  # or another placeholder string
    else:
        return obj

def save_ast_to_json(ast_dict, output_path):
    ast_dict = convert_to_serializable(ast_dict)  # Convert bytes and ellipses to serializable format
    with open(output_path, 'w', encoding='utf-8') as json_file:
        json.dump(ast_dict, json_file, ensure_ascii=False, indent=4)

def convert_serializable_to_original(obj):
    if isinstance(obj, dict):
        return {k: convert_serializable_to_original(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_serializable_to_original(i) for i in obj]
    elif isinstance(obj, str) and obj == '...':
        return Ellipsis
    elif isinstance(obj, str):
        try:
            return obj.encode('utf-8')  # or another appropriate decoding
        except UnicodeEncodeError:
            return obj  # Return the string as is if it can't be encoded
    else:
        return obj

def load_ast_from_json(json_path):
    with open(json_path, 'r', encoding='utf-8') as json_file:
        ast_dict = json.load(json_file)
    # return convert_serializable_to_original(ast_dict)
    return ast_dict
def dump_ast_for_directory(source_dir, output_dir):
    for root, _, files in os.walk(source_dir):
        for file in files:
            if file.endswith('.py'):
                input_path = os.path.join(root, file)
                relative_path = os.path.relpath(input_path, source_dir)
                output_path = os.path.join(output_dir, relative_path + '.json')
                
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                
                ast_dict = parse_code_to_ast(input_path)
                ast_dict['_namespace'] = relative_path.replace('.py', '').replace(os.path.sep, '.')
                ast_dict['_file'] = relative_path
                save_ast_to_json(ast_dict, output_path)
                print(f"Processed {input_path} -> {output_path}")


def build_ast_data(source_dir, output_dir):
    if not os.path.exists(source_dir):
        print(f"The source directory {source_dir} does not exist.")
        return
    
    os.makedirs(output_dir, exist_ok=True)
    
    dump_ast_for_directory(source_dir, output_dir)

def retrieve_method_callstack(ast_dir, file_name, method_name, output_file):
    if not os.path.exists(ast_dir):
        print(f"The AST directory {ast_dir} does not exist.")
        return
    asts = load_all_asts(ast_dir)
    call_stack = generate_call_stack(asts, file_name, method_name)
    # no_ext_file_name = file_name.replace('.py', '')
    # output_file = os.path.join(output_dir, f'{no_ext_file_name}_{method_name}.json')
    directory = os.path.dirname(output_file)
    if not os.path.exists(directory):
        os.makedirs(directory)


    with open(output_file, 'w') as f:
        json.dump(call_stack, f, indent=4)
    
    print(f"Call stack for method {method_name} in file {file_name}:")
    print(json.dumps(call_stack, indent=4))

    return output_file


def load_all_asts(output_dir):
    asts = {}
    for root, _, files in os.walk(output_dir):
        for file in files:
            if file.endswith('.json'):
                json_path = os.path.join(root, file)
                ast_dict = load_ast_from_json(json_path)
                relative_path = os.path.relpath(json_path, output_dir).replace('.json', '')
                asts[relative_path] = ast_dict
    return asts

def find_function_definitions(ast):
    function_full_names = {}
    
    # Extract the namespace and file name from the AST
    namespace = ast.get('_namespace', '')
    file_name = ast.get('_file', '')
    
    # Function to recursively find function definitions in the AST
    def find_functions(node, current_namespace):
        if isinstance(node, dict):
            if node.get('_type') == 'FunctionDef':
                function_name = node.get('name')
                full_function_name = f"{current_namespace}.{function_name}"
                function_full_names[full_function_name] = file_name
            # Recursively search in the body of the current node
            for key, value in node.items():
                find_functions(value, current_namespace)
        elif isinstance(node, list):
            for item in node:
                find_functions(item, current_namespace)
    
    # Start the recursive search
    find_functions(ast, namespace)
    
    return function_full_names

def find_method_calls(ast_dict, method_name, file_path,function_definitions):
    import_from_mapping = {}
    import_mapping = {}
    method_namespace = ast_dict.get('_namespace', '')

    class ImportVisitor(ast.NodeVisitor):
        def visit_ImportFrom(self, node):
            module_name = node.module
            for alias in node.names:
                import_from_mapping[alias.name] = module_name
            self.generic_visit(node)

        def visit_Import(self, node):
            for alias in node.names:
                import_mapping[alias.name] = alias.name
            self.generic_visit(node)

    class MethodCallVisitor(ast.NodeVisitor):
        def _match_call_with_import(self, call_name):
            if call_name in import_from_mapping:
                return import_from_mapping[call_name]+ '.' + call_name
            return call_name
        def _math_function_source(self,call_name):
            if call_name in function_definitions:
                return function_definitions[call_name]
            return ''
        def _is_same_namespace(self, call_name, function_definitions):
            return self.method_namespace+'.'+call_name in function_definitions
        def __init__(self, method_name, import_mapping, import_from_mapping,function_definitions,method_namespace):
            self.method_name = method_name
            self.calls = []
            self.current_function = None
            self.import_mapping = import_mapping
            self.import_from_mapping = import_from_mapping
            self.function_definitions = function_definitions
            self.method_namespace = method_namespace

        def visit_FunctionDef(self, node):
            if node.name == self.method_name:
                self.current_function = node.name
                self.generic_visit(node)
            self.current_function = None

        def visit_Call(self, node):
            if self.current_function:  # Only collect calls within functions
                if isinstance(node.func, ast.Name) and node.func.id != self.method_name:
                    if self._is_same_namespace(node.func.id, self.function_definitions):
                        self.calls.append({
                            'name': self.method_namespace +"." + node.func.id,
                            'file': file_path,
                            'lineno': node.lineno
                        })
                    else:
                        self.calls.append({
                            'name': self._match_call_with_import(node.func.id),
                            'file': self._math_function_source( self._match_call_with_import(node.func.id)),
                            'lineno': node.lineno
                        })
                elif isinstance(node.func, ast.Attribute) and node.func.attr != self.method_name:
                    func_full_name = self.get_reversed_attr(node.func)
                    self.calls.append({
                        'name': func_full_name,
                        'file': self._math_function_source(func_full_name),
                        'lineno': node.lineno
                    })
            self.generic_visit(node)
    
        def get_reversed_attr(self,node):
            attr_list = []
            while isinstance(node, ast.Attribute):
                attr_list.append(node.attr)
                node = node.value
            if isinstance(node, ast.Name):
                attr_list.append(node.id)
            return '.'.join(reversed(attr_list)) 
    ast_tree = dict_to_ast(ast_dict)
    import_visitor = ImportVisitor()
    import_visitor.visit(ast_tree)

    
    

    # method_ast = dict_to_ast(ast_dict)
    visitor = MethodCallVisitor(method_name,import_mapping,import_from_mapping,function_definitions,method_namespace)
    visitor.visit(ast_tree)
    return visitor.calls

def dict_to_ast(d):
    if isinstance(d, dict) and '_type' in d:
        node_type = getattr(ast, d['_type'])
        fields = {key: dict_to_ast(value) for key, value in d.items() if key != '_type'}
        node = node_type(**fields)
        if 'lineno' in d:
            node.lineno = d['lineno']
        return node
    elif isinstance(d, list):
        return [dict_to_ast(item) for item in d]
    else:
        return d

def find_defined_methods(ast_dict):
    methods = []
    if '_type' in ast_dict and ast_dict['_type'] == 'Module':
        for node in ast_dict.get('body', []):
            if node.get('_type') == 'FunctionDef':
                methods.append(node['name'])
    return methods

def generate_call_stack(asts, file_name, method_name):
    visited = set()

    function_definitions = {}
    for ast in asts.values():
        function_definitions.update(find_function_definitions(ast))

    def recursive_search(file, method, call_stack,function_definitions):
        if file not in asts:
            return call_stack
        ast_dict = asts[file]
        calls = find_method_calls(ast_dict, method.split('.')[-1], file,function_definitions)
        filtered_calls = []

        for call in calls:
            if call['name'] in function_definitions:
                filtered_calls.append(call)

        call_stack[f"{file}:{method}"] = filtered_calls
        for call in filtered_calls:
            if f"{call['file']}:{call['name']}" not in visited:
                visited.add(f"{call['file']}:{call['name']}")
                for f, ast in asts.items():
                    if call['name'] in find_function_definitions(ast):
                        recursive_search(f, call['name'], call_stack,function_definitions)
        return call_stack

    call_stack = {}
    return recursive_search(file_name, method_name, call_stack,function_definitions)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Retrieve a method call stacks given a set of ast.')
    parser.add_argument('-a','--ast_dir', type=str, help='The directory containing the ASTs.')
    parser.add_argument('-f','--file_name', type=str, help='The name of the file to analyze.')
    parser.add_argument('-m','--method_name', type=str, help='The name of the method to analyze.')
    parser.add_argument('-o','--output_file', type=str, help='The directory to save the output.')
    args = parser.parse_args()
    retrieve_method_callstack(args.ast_dir, args.file_name, args.method_name, args.output_file)
    # build_ast_data(source_dir, output_dir)

# retrieve_method_callstack(r"C:\Users\anthu\.code-analyzer\temp\analysis_output\2024-08-01T08-29-00-300Z\ast_info4",
#                           r"main_invoker.py",
#                           r"project_analysis",
#                           r"C:\Users\anthu\.code-analyzer\temp\analysis_output\2024-08-01T06-10-39-930Z\internal-call-graph\index\cliindex_cli2.json")
# 
# build_ast_data(r"C:\Users\anthu\projects\code2flow\CodeReader\src\python\folder_dependency",
#                 r"C:\Users\anthu\.code-analyzer\temp\analysis_output\2024-08-01T08-29-00-300Z\ast_info4")