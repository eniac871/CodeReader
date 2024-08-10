import os
import csv
from graphviz import Digraph

def create_graph_from_csv(graph, csv_file_path):
    with open(csv_file_path, mode='r') as file:
        reader = csv.reader(file)
        for row in reader:
            if len(row) != 6:
                continue
            type_, identifier, source, target, label, typekind= row
            if type_.lower() == 'node':
                if typekind == "Class":
                    graph.node(identifier, label, shape='rect', style='rounded,filled', fillcolor="#6db33f")
                elif typekind == "Interface":
                    graph.node(identifier, label, shape='rect', style='rounded,filled', fillcolor="#966F33")
            elif type_.lower() == 'edge':
                graph.edge(source, target, label)

def recursively_traverse_and_create_graphs(base_folder, output_folder, output_file_name, create_png=True, parent_graph=None):
    folder_name = os.path.basename(base_folder)
    graph = Digraph(name='graph')
    is_subgraph = bool(parent_graph)
    output_folder = os.path.join(output_folder, folder_name)
    output_file_name = folder_name if output_file_name is None else output_file_name + "." + folder_name
    is_leaf = True
    if is_subgraph:
        with graph.subgraph(name=f'cluster_{folder_name}') as subgraph:
            subgraph.attr(label=folder_name)
            if os.path.isfile(os.path.join(base_folder, 'graph.csv')):
                is_leaf = False
                create_graph_from_csv(subgraph, os.path.join(base_folder, 'graph.csv'))
            for item in os.listdir(base_folder):
                item_path = os.path.join(base_folder, item)
                if os.path.isdir(item_path):
                    is_leaf = False
                    recursively_traverse_and_create_graphs(item_path, output_folder, output_file_name, subgraph)
        parent_graph.subgraph(graph)
    else:
        is_leaf = False
        graph.attr(label=folder_name)
        if os.path.isfile(os.path.join(base_folder, 'graph.csv')):
            path = os.path.join(base_folder, 'graph.csv')
            print(path)
            create_graph_from_csv(graph, os.path.join(base_folder, 'graph.csv'))
        for item in os.listdir(base_folder):
            item_path = os.path.join(base_folder, item)
            if os.path.isdir(item_path):
                recursively_traverse_and_create_graphs(item_path, output_folder, output_file_name, graph)
    output_file_path = os.path.join(output_folder, f'{output_file_name}.dot')
    if not is_leaf:
        graph.save(directory=output_folder)
        if create_png:
            # ignore c# scenario create png as the picture is too large.
            graph.render(filename='graph', directory=output_folder, format='png')

def main(input_folder, output_folder):
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)
    folder_name = os.path.basename(input_folder)
    recursively_traverse_and_create_graphs(input_folder, output_folder, None)

if __name__ == '__main__':
    input_folder = './output/Microsoft'  # Change this to the input folder path
    output_folder = './output/graphs'  # Change this to the output folder path
    main(input_folder, output_folder)
