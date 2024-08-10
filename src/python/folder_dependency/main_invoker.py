from utils import find_folders_with_file
from python_file_analyzer import analyze_folder_dependency
from dependency_analyzer import analysis_dependency, generate_gv_result
from folder_analyzer import save_folder_info_to_json
from call_graph_analyzer import generate_call_graphs_for_folders, generate_call_graphs_for_function
from python_call_stack_generator import build_ast_data
from datetime import datetime
import os
import argparse

def folder_dependency_analysis(target_folder, output_folder="output"):
    # Find all folders containing the target file
    found_folders = find_folders_with_file(target_folder, 'pyproject.toml')

    output_list = []
    
    to_be_analyzed = []
    # If no folders contain the target file, print a message and return
    if found_folders:
        print("Found toml folder in this root folder, please double check whether you're trying to analysis a folder with sub packages")
        print("Folders containing the file:")
        for folder in found_folders:
            print(folder)
            to_be_analyzed.append(folder)
    
    if to_be_analyzed == []:
        to_be_analyzed.append(target_folder)
    
    for analysis_folder in to_be_analyzed:
        code_analysis_output = output_folder 
        # code_analysis_output = output_folder + os.path.sep + analysis_folder.split(os.path.sep)[-1] 

        if not os.path.exists(code_analysis_output):
            os.makedirs(code_analysis_output)
        analyze_folder_dependency(analysis_folder, code_analysis_output)
        output_list.append(code_analysis_output)
    return output_list


def project_analysis(target_folder, analysis_info_folder):
    # current_time = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    code_analysis_output_folder = analysis_info_folder + os.path.sep  + 'code_info'
    folder_analysis_output = analysis_info_folder + os.path.sep  + 'folder_info'
    folder_package_dep_analysis_output = analysis_info_folder  + os.path.sep + 'folder_package_dep_info'
    folder_call_graph_output = analysis_info_folder  + os.path.sep + 'folder_call_graph_info'
    ast_output = analysis_info_folder + os.path.sep + 'ast_info'
    
    code_analysis_result_path = folder_dependency_analysis(target_folder, code_analysis_output_folder)[0]
    save_folder_info_to_json(target_folder, folder_analysis_output, target_folder, code_analysis_result_path)
    
    analysis_dependency(code_analysis_result_path,folder_package_dep_analysis_output,"csv")
    generate_gv_result(folder_package_dep_analysis_output, folder_package_dep_analysis_output)

    generate_call_graphs_for_folders(target_folder, folder_call_graph_output)

    build_ast_data(target_folder, ast_output)
    
    return analysis_info_folder
    

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Analyze a project folder. ')
    parser.add_argument('-s', '--source', type=str, help='The path to the project source code root folder.')
    parser.add_argument('-o', '--output', type=str, help='The path to the output folder.')
    parser.add_argument('-t', '--target_function', type=str, help='The target function to generate call graph for.')
    parser.add_argument('-l', '--language', type=str, choices=['csharp', 'python', 'java'], help='The programming language of the project (e.g., csharp, python, java)')

    args = parser.parse_args()

    project_folder = args.source
    output_folder = args.output
    target_function = args.target_function
    language = args.language


    # project_folder = r"C:\Users\anthu\projects\code2flow\promptflow\src\promptflow-devkit\promptflow"
    # output_folder = r"C:\Users\anthu\.code-analyzer\temp\analysis_output\2024-07-30T08-50-01-324Z"
    # target_function = "register_executor"
    print(target_function)

    if (target_function):
        generate_call_graphs_for_function(project_folder, output_folder, target_function)
    if (language == 'csharp'):
        generate_gv_result(project_folder, output_folder, False)
    else:
        project_analysis(project_folder, output_folder)
    
    
