import os

def find_folders_with_file(root_dir, target_file):
    folders_with_file = []
    
    # Walk through the directory tree
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Check if the target file is in the current directory
        if target_file in filenames and dirpath != root_dir:
            folders_with_file.append(dirpath)
    
    # Return the list of folders or None if no folders were found
    return folders_with_file if folders_with_file else None

def is_file_in_folder(file_name, folder_path):

    # Get the list of files in the folder
    try:
        files_in_folder = os.listdir(folder_path)
    except FileNotFoundError:
        print(f"The folder '{folder_path}' does not exist.")
        return False
    except NotADirectoryError:
        print(f"The path '{folder_path}' is not a directory.")
        return False

    # Check if the file is in the list of files
    return file_name in files_in_folder
