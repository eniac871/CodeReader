import ast
import os
import json
from pathlib import Path
from dataclasses import dataclass, field,asdict
from typing import List,Dict
from utils import is_file_in_folder
from toml_analyzer import find_package_folder_from_toml

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

# A class to parse the python source code
class CodeParser:
    def parse_file(self, root_path:Path, file_path: Path) -> FileInfo:
        with open(file_path, "r", encoding="utf-8") as file:
            tree = ast.parse(file.read(), filename=file_path)
        
        # Initialize FileInfo object
        file_info = FileInfo(root_path=str(root_path.resolve()), file_name="")

        
        file_info.relative_path =  str(file_path.parent.relative_to(root_path))
        if (file_info.relative_path == "."):
            file_info.relative_path = ""
            file_info.package_name = file_info.root_path.split(os.path.sep)[-1]
        else:
            file_info.package_name = file_info.root_path.split(os.path.sep)[-1]+"."+file_info.relative_path.replace(os.path.sep, ".").replace(".py", "")
        file_info.file_name = file_path.name
                
        for node in ast.walk(tree):
            # Check for import statements (both import and from .. import)
            if isinstance(node, ast.Import):
                for alias in node.names:
                    file_info.imports.append(alias.name)

            # Check for from .. import statements
            # TODO： Handle from .. import * statements
            if isinstance(node, ast.ImportFrom):
                module = node.module if node.module else ""
                if module not in file_info.from_imports:
                    file_info.from_imports[module] = []
                for alias in node.names:
                    file_info.from_imports[module].append(alias.name)
            
            # Check for class definitions
            if isinstance(node, ast.ClassDef):
                class_info = {"class_name": node.name, "methods": []}
                for elem in node.body:
                    if isinstance(elem, ast.FunctionDef) or isinstance(elem, ast.AsyncFunctionDef):
                        class_info["methods"].append(elem.name)
                        function_info = {
                            "name": node.name + "." + elem.name,
                            "args": [arg.arg for arg in elem.args.args],
                            "defaults": [ast.dump(default) for default in elem.args.defaults],
                            "is_async": isinstance(node, ast.AsyncFunctionDef),
                            "access": "public" if not node.name.startswith("_") else "private"
                        }
                        file_info.functions.append(function_info)
                file_info.classes.append(class_info)
            if isinstance(node, ast.FunctionDef) or isinstance(node, ast.AsyncFunctionDef):
                function_info = {
                    "name": node.name,
                    "args": [arg.arg for arg in node.args.args],
                    "defaults": [ast.dump(default) for default in node.args.defaults],
                    "is_async": isinstance(node, ast.AsyncFunctionDef),
                    "access": "public" if not node.name.startswith("_") else "private"
                }
                file_info.functions.append(function_info)
        
        return file_info

def write_file_info_to_json(file_info: FileInfo, file_path: Path):
    file_path.parent.mkdir(parents=True, exist_ok=True)
    with file_path.open('w') as f:
        json.dump(asdict(file_info), f, indent=4)

def process_python_files(input_root: Path, output_root: Path):
    parser = CodeParser()  
    for python_file in input_root.rglob('*.py'):
        print(f"Processing: {python_file}")
        try:
            file_info = parser.parse_file(root_path=input_root, file_path= python_file)
        except Exception as e:
            print(f"Error processing {python_file}: {e}")
            continue
        relative_path = python_file.relative_to(input_root)
        output_file = output_root / relative_path.with_suffix('.json')
        write_file_info_to_json(file_info, output_file)
        print(f"Processed and written: {output_file}")

def analyze_folder_dependency(target_folder, output_folder="output"):

    src_folder = Path(target_folder)
    if is_file_in_folder('pyproject.toml', target_folder):
        sub_path = find_package_folder_from_toml(target_folder + os.path.sep + 'pyproject.toml')
        src_folder = Path(target_folder+os.path.sep+sub_path[0])

    target_folder = Path(output_folder)
    process_python_files(src_folder, target_folder)




# # Example usage
if __name__ == "__main__":
    analyze_folder_dependency(r'C:\Users\anthu\projects\code2flow\target_repo\graphrag\graphrag\index\input', r'C:\Users\anthu\projects\code2flow\repo_advisor\output')
    # file_path = 'path/to/your/pyproject.toml'
    # include_values = parse_pyproject_toml(file_path)
    # print(include_values)