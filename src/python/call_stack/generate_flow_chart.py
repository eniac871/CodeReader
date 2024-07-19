# filename: generate_flow_chart.py  
  
import os  
import ast  
from graphviz import Digraph  
  
def find_function_calls(node, function_name):  
    calls = []  
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == function_name:  
        calls.append(node)  
    for child in ast.iter_child_nodes(node):  
        calls.extend(find_function_calls(child, function_name))  
    return calls  
  
def extract_call_stacks(file_path, function_name):  
    print(file_path)
    if file_path.endswith('_connection.py'):
        print("here")
    with open(file_path, 'r', encoding='utf-8') as file:  
        tree = ast.parse(file.read(), filename=file_path)  
      
    call_stacks = []  
    for node in ast.walk(tree):  
        if isinstance(node, ast.FunctionDef):
            if node.name == function_name:  
                call_stacks.extend(find_function_calls(node, function_name))  
    return call_stacks  
  
def traverse_directory(directory, function_name):  
    call_stacks = {}  
    for root, _, files in os.walk(directory):  
        for file in files:  
            if file.endswith('.py'):  
                file_path = os.path.join(root, file)  
                calls = extract_call_stacks(file_path, function_name)  
                if calls:  
                    call_stacks[file_path] = calls  
    return call_stacks  
  
def generate_flow_chart(call_stacks, output_file):  
    dot = Digraph(comment='Call Stack Flow Chart')  
      
    for file_path, calls in call_stacks.items():  
        for call in calls:  
            caller = f"{file_path}:{call.lineno}"  
            # print(caller)
            callee = call.func.id  
            dot.node(caller, caller)  
            dot.node(callee, callee)  
            dot.edge(caller, callee)  
      
    dot.render(output_file, view=True)  
  
# Directory to traverse  
directory = r'C:\Users\anthu\projects\code2flow\promptflow\src'  
function_name = 'add_connection_create'  
output_file = 'call_stack_flow_chart'  
  
# Extract call stacks  
call_stacks = traverse_directory(directory, function_name)  
  
# Generate flow chart  
generate_flow_chart(call_stacks, output_file)  