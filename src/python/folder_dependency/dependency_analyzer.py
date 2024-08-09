from dataclasses import dataclass, field,asdict
from typing import List,Dict
import json
import os
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Set
from generate_class_graph import recursively_traverse_and_create_graphs
# Define a data class to store information
@dataclass
class FileInfo:
    root_path: str    
    file_name: str
    relative_path: str = ""
    package_name: str = ""
    imports: List[str] = field(default_factory=list)
    from_imports: Dict[str, List[str]] = field(default_factory=dict)
    classes: List[dict] = field(default_factory=list)
    functions: List[str] = field(default_factory=list)



def load_file_info_from_json(file_path: str) -> FileInfo:
    file_path = Path(file_path)
    with file_path.open('r') as f:
        data = json.load(f)
    return FileInfo(**data)

def summarize_defined_modules(input_folder: Path) -> Dict[str,str]:
    defined_modules = {}
    for json_file in input_folder.rglob('*.json'):
        file_info = load_file_info_from_json(json_file)
        defined_modules[file_info.package_name+"."+file_info.file_name.replace(".py", "")] = file_info.relative_path+"\\"+file_info.file_name
    return defined_modules

def traverse_folder_recursively(folder_path):
    """
    Recursively traverse the files and folders starting from folder_path.

    Parameters:
    - folder_path (str): The path to the folder to traverse.
    """
    import_deps: Set[str] = set()
    package_full_set : Set[str] = set()
    for item in os.listdir(folder_path):
        item_path = os.path.join(folder_path, item)
        if (item_path.find("executable") != -1):
            print(item_path)
        if os.path.isdir(item_path):
            # If the item is a folder, recurse into it
            inner_imports,inner_package_full_set = traverse_folder_recursively(item_path)
            import_deps = import_deps.union(inner_imports)
            package_full_set = package_full_set.union(inner_package_full_set)
        elif item_path.endswith('.json'):
            import_deps = import_deps.union(fetch_dep_imports(item_path))
            package_full_set.add(fetch_package_full(item_path))
            
        else:
            # Process other file types if necessary
            print(f"Found non-JSON file: {item_path}")
    return import_deps,package_full_set

def process_folder(folder_path,package_root="") :
    """
    Process the first-level files and folders within the specified folder_path.

    Parameters:
    - folder_path (str): The path to the folder to process.
    """
    item_dependencies: Dict[str, Set[str]] = defaultdict(set)
    package_dict: Dict[str, Set[str]] = defaultdict(set)
    for item in os.listdir(folder_path):
        item_path = os.path.join(folder_path, item)
        if os.path.isdir(item_path):
            folder_key = package_root+"."+item_path.split("\\")[-1] 
            # If the item is a folder, delegate to the recursive traversal function
            deps,package_full_set = traverse_folder_recursively(item_path)
            item_dependencies[folder_key] = deps
            package_dict[folder_key] = package_full_set
        elif item_path.endswith('.json'):
            # If the item is a JSON file, read it
            file_info = load_file_info_from_json(item_path)
            folder_key = file_info.package_name + "." + file_info.file_name.replace(".py", "")
            item_dependencies[folder_key] = fetch_dep_imports(item_path)
            package_dict[folder_key] = fetch_package_full(item_path)
        else:
            # Process other file types if necessary
            print(f"Found non-JSON file: {item_path}")

    return item_dependencies,package_dict


def fetch_dep_imports(file_path: Path) -> List[str]:
    file_info = load_file_info_from_json(file_path)
    return set(file_info.imports).union(file_info.from_imports.keys())

def fetch_package_full(file_path: Path) -> str:
    file_info = load_file_info_from_json(file_path)
    return file_info.package_name+"."+file_info.file_name.replace(".py", "")

import graphviz

def generate_dep_node_edges(package_dict,dependency_dict): 
        # Filter the dependencies to only include those in the package list
    def is_dependency_valid(dep, package_dict:Dict[str,Set[str]]) -> str:
        for package, deps in package_dict.items():
            if dep in deps:
                return package
        return ''

    filtered_dependencies = {}
    for package, deps in dependency_dict.items():
        valid_deps = set()
        for dep in deps:
            founded_dep = is_dependency_valid(dep, package_dict)
            if founded_dep != '' and founded_dep != package:
                valid_deps.add(founded_dep)
        # if is_dependency_valid(package, package_list):
        filtered_dependencies[package] = valid_deps
    


    return filtered_dependencies

def generate_dependency_graph_graphviz(package_dict:Dict[str,Set[str]], dependency_dict):
    filtered_dependencies = generate_dep_node_edges(package_dict,dependency_dict)

    # # Return the DOT graph representation
    # return dot
    # Initialize a directed graph
    dot = graphviz.Digraph(comment='Package Dependency Graph')
    
    topological_sorted = topological_sort(filtered_dependencies)
    # # Add nodes (packages)
    for package in topological_sorted:
        dot.node(package, package)
    print(filtered_dependencies)
    print(topological_sorted)
    # Add edges (dependencies)
    for package, deps in filtered_dependencies.items():
        for dep in deps:
            dot.edge(package, dep)
    
    # Return the DOT graph representation
    return dot

def generate_dependency_graph_csv(package_dict:Dict[str,Set[str]], dependency_dict):
    filtered_dependencies = generate_dep_node_edges(package_dict,dependency_dict)
    # Prepare data for CSV
    csv_data = []
    csv_data.append(['Type', 'Source', 'Target', 'Label', 'Identifier', 'TypeKind'])

    # Extract nodes information
    for package in filtered_dependencies:
        csv_data.append(['Node', package, '', '', '', 'Class'])

    # Extract edges information
    for package, deps in filtered_dependencies.items():
        for dep in deps:
            csv_data.append(['Edge', package, dep, '', '', ''])

    return csv_data

from typing import Dict, Set, List
from collections import deque

def topological_sort(dependencies: Dict[str, Set[str]]) -> List[str]:
    # Calculate in-degrees of all nodes
    in_degree = {node: 0 for node in dependencies}
    for deps in dependencies.values():
        for dep in deps:
            if dep in in_degree:  # Ensure dep is a known node
                in_degree[dep] += 1
            else:
                in_degree[dep] = 1  # Handle nodes not explicitly mentioned as keys
    sort_in_degree = sorted(in_degree.items(), key=lambda x: x[1])


    return [node for node, _ in sort_in_degree]

import os

def find_subfolders(root_folder):
    subfolders = ['']
    for root, dirs, files in os.walk(root_folder):
        for dir in dirs:
            # Calculate the relative path of the subfolder
            rel_path = os.path.relpath(os.path.join(root, dir), start=root_folder)
            # Replace os.path.sep with '\' to ensure the format matches your example
            rel_path = rel_path.replace(os.path.sep, '\\')
            subfolders.append(rel_path)
    return subfolders

def write_csv_data(output_folder, csv_data):
    with open(output_folder, 'w') as f:
        for row in csv_data:
            f.write(','.join(row) + '\n')

def analysis_dependency(root_folder, output_folder, format="png"):
    targetfolders = find_subfolders(root_folder)
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)

    for folder in targetfolders:
        print(folder)
        input_folder = Path(root_folder) / folder
        sub_package = '' if folder == '' else '.'+folder.replace("\\",".")
        print(input_folder)
        # import_dependencies, package_dict = process_folder(input_folder, package_root="promptflow"+sub_package)
        import_dependencies, package_dict = process_folder(input_folder, package_root=sub_package)
        
        output_pattern = output_folder+sub_package.replace(".",os.path.sep)
        # if output pattern does not exist, create it
        if not os.path.exists(output_pattern):
            os.makedirs(output_pattern)
        
        if format == "csv":
            csv_data = generate_dependency_graph_csv(package_dict, import_dependencies)
            write_csv_data(output_pattern+"\\graph.csv", csv_data)
                     
        else:
            generate_dependency_graph_graphviz(package_dict, import_dependencies).render(output_pattern+"\\dependency_graph_", format=format, cleanup=True)


def generate_dot_result(output_folder):
    # temporarily only read 1 graph.csv. And generate graph.dot in the same folder.
    recursively_traverse_and_create_graphs(output_folder, output_folder, "graph")


if __name__ == "__main__":
    project_name = "promptflow"
    root_folder = r"C:\Users\anthu\projects\code2flow\depana\output_"+project_name
    output_folder= r"C:\Users\anthu\projects\code2flow\depana\graph_output_"+project_name
    format = "png"
    analysis_dependency(root_folder,output_folder,"csv")

    