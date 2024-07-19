import toml

def find_package_folder_from_toml(file_path):
    try:
        # Read and parse the pyproject.toml file
        with open(file_path, 'r') as f:
            pyproject_data = toml.load(f)
        
        # Check for the 'packages' field under 'tool.poetry'
        packages = pyproject_data.get('tool', {}).get('poetry', {}).get('packages', None)
        
        if not packages:
            return "No 'packages' field found in pyproject.toml."
        
        # Extract the values of the 'include' field
        include_values = [pkg.get('include') for pkg in packages if 'include' in pkg]
        
        if include_values:
            return include_values
        else:
            return "No 'include' fields found in 'packages'."
    except Exception as e:
        return f"Error parsing pyproject.toml: {e}"

# # Example usage
# file_path = 'path/to/your/pyproject.toml'
# include_values = parse_pyproject_toml(file_path)
# print(include_values)
