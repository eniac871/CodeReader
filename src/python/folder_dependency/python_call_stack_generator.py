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

def find_method_calls(ast_dict, method_name, file_path):
    class MethodCallVisitor(ast.NodeVisitor):
        def __init__(self, method_name):
            self.method_name = method_name
            self.calls = []
            self.current_function = None

        def visit_FunctionDef(self, node):
            if node.name == self.method_name:
                self.current_function = node.name
                self.generic_visit(node)
            self.current_function = None

        def visit_Call(self, node):
            if self.current_function:  # Only collect calls within functions
                if isinstance(node.func, ast.Name) and node.func.id != self.method_name:
                    self.calls.append({
                        'name': node.func.id,
                        'file': file_path,
                        'lineno': node.lineno
                    })
                elif isinstance(node.func, ast.Attribute) and node.func.attr != self.method_name:
                    self.calls.append({
                        'name': node.func.attr,
                        'file': file_path,
                        'lineno': node.lineno
                    })
            self.generic_visit(node)

    method_ast = dict_to_ast(ast_dict)
    visitor = MethodCallVisitor(method_name)
    visitor.visit(method_ast)
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

    def recursive_search(file, method, call_stack):
        if file not in asts:
            return call_stack
        ast_dict = asts[file]
        calls = find_method_calls(ast_dict, method, file)
        filtered_calls = [call for call in calls if any(call['name'] in find_defined_methods(ast) for ast in asts.values())]
        call_stack[f"{file}:{method}"] = filtered_calls
        for call in filtered_calls:
            if f"{call['file']}:{call['name']}" not in visited:
                visited.add(f"{call['file']}:{call['name']}")
                for f, ast in asts.items():
                    if call['name'] in find_defined_methods(ast):
                        recursive_search(f, call['name'], call_stack)
        return call_stack

    call_stack = {}
    return recursive_search(file_name, method_name, call_stack)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Retrieve a method call stacks given a set of ast.')
    parser.add_argument('-a','--ast_dir', type=str, help='The directory containing the ASTs.')
    parser.add_argument('-f','--file_name', type=str, help='The name of the file to analyze.')
    parser.add_argument('-m','--method_name', type=str, help='The name of the method to analyze.')
    parser.add_argument('-o','--output_file', type=str, help='The directory to save the output.')
    args = parser.parse_args()
    retrieve_method_callstack(args.ast_dir, args.file_name, args.method_name, args.output_file)
    # build_ast_data(source_dir, output_dir)

# retrieve_method_callstack(r"C:\Users\anthu\.code-analyzer\temp\analysis_output\2024-08-01T06-10-39-930Z\ast_info",
#                           r"index\cli.py",
#                           r"index_cli",
#                           r"C:\Users\anthu\.code-analyzer\temp\analysis_output\2024-08-01T06-10-39-930Z\internal-call-graph\index\cliindex_cli.json")

# build_ast_data(r"C:\Users\anthu\projects\code2flow\target_repo\graphrag\graphrag\index\input",
#                 r"C:\Users\anthu\.code-analyzer\temp\analysis_output\2024-08-01T05-51-31-944Z\ast_info")