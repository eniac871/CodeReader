import code2flow
from code2flow.engine import SubsetParams
import os
import pathlib


def _generate_call_path(raw_source_paths, output_file, target_function = "", upstream_depth = 5, downstream_depth = 10):
    
    if target_function is None or target_function == '':
        try: 
            code2flow.code2flow(raw_source_paths=raw_source_paths, language='py',  output_file=output_file)
        except Exception as e:
            print(f"Error generating call graph: {e}")
    else:       
        subset_params = SubsetParams.generate(target_function, upstream_depth,
                                            downstream_depth)
        try:
            code2flow.code2flow(raw_source_paths=raw_source_paths, language='py', subset_params=subset_params, output_file=output_file)
        except Exception as e:
            print(f"Error generating call graph: {e}")
    
def generate_call_graphs_for_folders(src_folder: str, output_folder: str, extension ='.png'):
    """Recursively generate call graphs for each folder"""
    for root, dirs, files in os.walk(src_folder):
        relative_path = os.path.relpath(root, src_folder)
        output_dir = os.path.join(output_folder, relative_path)
        pathlib.Path(output_dir).mkdir(parents=True, exist_ok=True)
        output_file = os.path.join(output_dir, 'call_graph'+ extension)
        _generate_call_path(root, output_file)
        # if dirs:
        #     python_files = [os.path.join(root, file) for file in files if file.endswith('.py')]
        #     if python_files:
        #         relative_path = os.path.relpath(root, src_folder)
        #         output_dir = os.path.join(output_folder, relative_path)
        #         pathlib.Path(output_dir).mkdir(parents=True, exist_ok=True)
        #         output_file = os.path.join(output_dir, 'call_graph.png')
        #         generate_call_path(python_files, output_file, target_function)

def generate_call_graphs_for_function(src_folder: str, output_folder: str, target_function: str):
    
    _generate_call_path(src_folder, os.path.join( output_folder, target_function+".png"), target_function)


if __name__ == "__main__":
    generate_call_graphs_for_folders(src_folder =r'C:\Users\anthu\projects\code2flow\target_repo\promptflow\src\promptflow-devkit\promptflow',
                       output_folder= r'C:\Users\anthu\projects\code2flow\repo_advisor\crui_output\callgraphtest\promptflow',extension='.json')
    # generate_call_graphs_for_function(src_folder =r'C:\Users\anthu\projects\code2flow\target_repo\promptflow\src\promptflow-devkit\promptflow',
    #                    output_folder= r'C:\Users\anthu\projects\code2flow\repo_advisor\crui_output\callgraphtest\promptflow', 
    #                    target_function = 'run_command')
