import os
import json

def is_source_code_file(filename):
    source_code_extensions = {'.py', '.js', '.java', '.cpp', '.c', '.cs', '.rb', '.html', '.css', '.php'}
    _, ext = os.path.splitext(filename)
    return ext in source_code_extensions

def count_lines_in_file(filepath):
    with open(filepath, 'r', errors='ignore') as file:
        return sum(1 for _ in file)
    
def parse_metadata_file(metadata_file):
    with open(metadata_file, 'r') as file:
        metadata = json.load(file)

    class_count = len(metadata.get('classes', []))
    function_count = len(metadata.get('functions', []))
    public_function_count = sum(1 for func in metadata.get('functions', []) if func['access'] =='public')
    private_function_count = function_count - public_function_count

    return class_count, function_count, public_function_count, private_function_count

def gather_folder_info(folder_path,metadata_path):
    total_files = 0
    total_folders = 0
    total_source_files = 0
    total_source_lines = 0
    total_class_count = 0
    total_function_count = 0
    total_public_function_count = 0
    total_private_function_count = 0
    first_level_subfolders = {}
    
    for root, dirs, files in os.walk(folder_path):
        if root == folder_path:  # Only first level subfolders
            for dir_name in dirs:
                subfolder_path = os.path.join(root, dir_name)
                subfolder_metadata_path = os.path.join(metadata_path, os.path.relpath(subfolder_path, folder_path))
                subfolder_info = gather_folder_info(subfolder_path,subfolder_metadata_path)
                first_level_subfolders[dir_name] = subfolder_info
        
        # Handle the files in the current folder
        total_folders += len(dirs)
        for file_name in files:
            total_files += 1
            file_path = os.path.join(root, file_name)
            if is_source_code_file(file_name):
                total_source_files += 1
                total_source_lines += count_lines_in_file(file_path)
                metadata_file = os.path.join(metadata_path, os.path.relpath(file_path, folder_path).removesuffix('.py') + '.json')
                if os.path.exists(metadata_file):
                    class_count, function_count, public_function_count, private_function_count = parse_metadata_file(metadata_file)
                    total_class_count += class_count
                    total_function_count += function_count
                    total_public_function_count += public_function_count
                    total_private_function_count += private_function_count
        
        # sum up sub folder's count
        for folder_info in first_level_subfolders.values():
            total_files += folder_info['total_files']
            total_folders += folder_info['total_folders']
            total_source_files += folder_info['total_source_files']
            total_source_lines += folder_info['total_source_lines']
            total_class_count += folder_info['total_class_count']
            total_function_count += folder_info['total_function_count']
            total_public_function_count += folder_info['total_public_function_count']
            total_private_function_count += folder_info['total_private_function_count']
            
        break  # Stop after first level to avoid deep recursion

    return {
        'total_files': total_files,
        'total_folders': total_folders,
        'total_source_files': total_source_files,
        'total_source_lines': total_source_lines,
        'total_class_count': total_class_count,
        'total_function_count': total_function_count,
        'total_public_function_count': total_public_function_count,
        'total_private_function_count': total_private_function_count,
        'first_level_subfolders': first_level_subfolders
    }

def convert_to_d3_tree(data, root_name="root"):
    def create_node(name, data):
        node = {
            "name": name,
            "total_files": data["total_files"],
            "total_folders": data["total_folders"],
            "total_source_files": data["total_source_files"],
            "total_source_lines": data["total_source_lines"],
            "total_class_count": data["total_class_count"],
            "total_function_count": data["total_function_count"],
            "total_public_function_count": data["total_public_function_count"],
            "total_private_function_count": data["total_private_function_count"],
            "children": []
        }
        for subfolder_name, subfolder_data in data["first_level_subfolders"].items():
            child_node = create_node(subfolder_name, subfolder_data)
            node["children"].append(child_node)
        return node

    root_node = create_node(root_name, data)
    return root_node

def save_folder_info_to_json(folder_path, output_path, root_folder_path,metadata_path):
    folder_info = gather_folder_info(folder_path,metadata_path)
    relative_path = os.path.relpath(folder_path, root_folder_path)
    json_output_path = os.path.join(output_path, relative_path, 'info.json')
    d3_format = convert_to_d3_tree(folder_info, relative_path)

    os.makedirs(os.path.dirname(json_output_path), exist_ok=True)
    with open(json_output_path, 'w') as json_file:
        json.dump(d3_format, json_file, indent=4)

    for subfolder in folder_info['first_level_subfolders']:
        save_folder_info_to_json(os.path.join(folder_path, subfolder), output_path, root_folder_path,metadata_path)


def main(root_folder_path, output_folder_path, metadata_folder_path):
    save_folder_info_to_json(root_folder_path, output_folder_path, root_folder_path, metadata_folder_path)

if __name__ == '__main__':
    root_folder_path = r'C:\Users\anthu\projects\code2flow\target_repo\promptflow\src\promptflow-core\promptflow\core'  # Change this to your root folder path
    output_folder_path = r'C:\Users\anthu\projects\code2flow\repo_advisor\folder_output'  # Change this to your desired output path
    metadata_folder_path = r'C:\Users\anthu\projects\code2flow\repo_advisor\output\promptflow-core\core'  # Change this to your metadata folder path
    main(root_folder_path, output_folder_path,metadata_folder_path)
