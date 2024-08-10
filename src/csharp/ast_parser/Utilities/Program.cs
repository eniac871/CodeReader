using DotNetGraph.Compilation;
using DotNetGraph.Core;
using DotNetGraph.Extensions;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using Formatting = Newtonsoft.Json.Formatting;

class Program
{
    static void Main(string[] args)
    {
        if (args.Length < 2)
        {
            Console.WriteLine("Usage: <program> <project_folder> <output_root_folder>");
            string currentDirectory = Directory.GetCurrentDirectory();
            ProcessDirectory("D:\\code\\vienna\\src\\azureml-api\\src\\Designer\\src\\MiddleTier\\MiddleTier", "C:\\Users\\tingxilin\\.code-analyzer\\temp\\analysis_output\\2024-08-17T15-52-48-851Z");
            // ProcessDirectory("D:\\code\\airflow\\airflow\\cli", "C:\\Users\\tingxilin\\.code-analyzer\\temp\\analysis_output\\2024-08-17T15-52-48-851Z");
            // ProcessDirectory("E:\\vienna\\src\\azureml-api\\src\\Designer\\src\\MiddleTier\\MiddleTier", ".\\output");
            return;
        }

        string projectFolder = args[0];
        string outputRootFolder = args[1];

        ProcessDirectory(projectFolder, outputRootFolder);
    }

    static void ProcessDirectory(string folderPath, string outputRootFolder)
    {
        var allFilesMetadata = new Dictionary<string, List<TypeMetadata>>();

        foreach (var file in Directory.EnumerateFiles(folderPath, "*.cs", SearchOption.AllDirectories))
        {
            Console.WriteLine($"Parsing: {file}");
            ParseFile(file, outputRootFolder, allFilesMetadata);
        }

        GenerateDependencyGraph(allFilesMetadata, outputRootFolder);
    }

    static void ParseFile(string filePath, string outputRootFolder, Dictionary<string, List<TypeMetadata>> allFilesMetadata)
    {
        var code = File.ReadAllText(filePath);
        var syntaxTree = CSharpSyntaxTree.ParseText(code);
        var root = syntaxTree.GetRoot();

        var classes = root.DescendantNodes().OfType<ClassDeclarationSyntax>().ToList();
        var interfaces = root.DescendantNodes().OfType<InterfaceDeclarationSyntax>().ToList();
        var sturcts = root.DescendantNodes().OfType<StructDeclarationSyntax>().ToList();

        var usings = root.DescendantNodes().OfType<UsingDirectiveSyntax>()
                         .Select(u => u.ToString())
                         .ToList();

        foreach (var classDecl in classes)
        {
            ParseTypeDeclaration(filePath, outputRootFolder, classDecl, TypeKind.Class, usings, allFilesMetadata);
        }

        foreach (var interfaceDecl in interfaces)
        {
            ParseTypeDeclaration(filePath, outputRootFolder, interfaceDecl, TypeKind.Interface, usings, allFilesMetadata);
        }

        foreach (var sturctDecf in sturcts)
        {
            ParseTypeDeclaration(filePath, outputRootFolder, sturctDecf, TypeKind.Struct, usings, allFilesMetadata);
        }
    }

    static void ParseTypeDeclaration(string filePath, string outputRootFolder, TypeDeclarationSyntax typeDecl, TypeKind typeKeyword, List<string> usings, Dictionary<string, List<TypeMetadata>> allFilesMetadata)
    {
        // Determine Namespace  
        var namespaceNode = typeDecl.FirstAncestorOrSelf<NamespaceDeclarationSyntax>();
        string namespacePath = namespaceNode?.Name.ToString().Replace('.', Path.DirectorySeparatorChar) ?? string.Empty;

        // Create full directory path based on namespace and type name  
        string typeName = typeDecl.Identifier.Text;
        string outputFolder = Path.Combine(outputRootFolder, namespacePath, typeName);
        Directory.CreateDirectory(outputFolder);
        
        // Create file paths  
        string metadataFile = Path.Combine(outputFolder, "metadata.json");
        string syntaxTreeFile = Path.Combine(outputFolder, "syntaxtree.txt");

        // Collect type metadata  
        var typeMetadata = new TypeMetadata
        {
            FileName = Path.GetFileName(filePath),
            FilePath = filePath,
            TypeName = typeName,
            TypeKind = typeKeyword,
            Usings = usings,
            Namespace = namespaceNode?.Name?.ToString(),
            Properties = new PropertiesMetadata
            {
                IsStatic = typeDecl.Modifiers.Any(SyntaxKind.StaticKeyword),
                IsSealed = typeDecl.Modifiers.Any(SyntaxKind.SealedKeyword),
                IsAbstract = typeDecl.Modifiers.Any(SyntaxKind.AbstractKeyword),
                HasNumeric = typeDecl.Members.OfType<FieldDeclarationSyntax>().Any(f => f.Declaration.Type is PredefinedTypeSyntax predefinedType && predefinedType.Keyword.IsKind(SyntaxKind.IntKeyword)),
                IsInherited = typeDecl.BaseList != null,
                BaseTypeNames = typeDecl.BaseList?.Types.Select(x => x.ToString())?.ToList()
            },
            Functions = typeDecl.Members.OfType<MethodDeclarationSyntax>().Select(method => new FunctionMetadata
            {
                FunctionName = method.Identifier.Text,
                FunctionType = method.Modifiers.Any(SyntaxKind.StaticKeyword) ? "static" : "instance",
                ReturnType = method.ReturnType.ToString(),
                FunctionBody = method.Body?.ToString(),
                Parameters = method.ParameterList.Parameters.Select(param => new ParameterMetadata
                {
                    ParameterType = param.Type.ToString(),
                    ParameterName = param.Identifier.Text
                }).ToList()
            }).ToList()
        };

        // Add metadata to the dictionary categorized by namespace
        if (!allFilesMetadata.ContainsKey(namespacePath))
            allFilesMetadata[namespacePath] = new List<TypeMetadata>();
        allFilesMetadata[namespacePath].Add(typeMetadata);

        // Write JSON metadata to file  
        string json = JsonConvert.SerializeObject(typeMetadata, Formatting.Indented);
        File.WriteAllText(metadataFile, json);

        // Write syntax tree of current type to file
        string syntaxTreeText = typeDecl.ToFullString();
        File.WriteAllText(syntaxTreeFile, syntaxTreeText);
    }

    static void GenerateDependencyGraph(Dictionary<string, List<TypeMetadata>> allFilesMetadata, string outputRootFolder)
    {
        foreach (var namespaceGroup in allFilesMetadata)
        {
            string namespacePath = namespaceGroup.Key;
            var typesMetadata = namespaceGroup.Value;

            // Create full directory path based on namespace
            string namespaceFolder = Path.Combine(outputRootFolder, namespacePath);
            Directory.CreateDirectory(namespaceFolder);

            // Create graph.csv file path
            string graphFile = Path.Combine(namespaceFolder, "graph.csv");

            var graphData = new List<string>
            {
                "Type,Identifier,Source,Target,Label,TypeKind" // CSV header
            };

            foreach (var typeMetadata in typesMetadata)
            {
                // Add the node
                graphData.Add($"node,{typeMetadata.GetIdentifier()},,,{typeMetadata.TypeName},{typeMetadata.TypeKind}");
                string typeSyntaxTreePath = Path.Combine(outputRootFolder, namespacePath, typeMetadata.TypeName, "syntaxtree.txt");
                string typeSyntaxTreeText = File.ReadAllText(typeSyntaxTreePath);

                // Within the same namespace: Check other types for references
                foreach (var otherTypeMetadata in typesMetadata.Where(t => t.TypeName != typeMetadata.TypeName))
                {
                    if (typeMetadata.Properties.IsInherited && typeMetadata.Properties.BaseTypeNames.Contains(otherTypeMetadata.TypeName))
                    {
                        graphData.Add($"node,{otherTypeMetadata.GetIdentifier()},,,{otherTypeMetadata.TypeName},{otherTypeMetadata.TypeKind}");

                        if (otherTypeMetadata.TypeKind == TypeKind.Interface)
                        {
                            graphData.Add($"edge,,{typeMetadata.GetIdentifier()},{otherTypeMetadata.GetIdentifier()},implement,");
                        }
                        else
                        {
                            graphData.Add($"edge,,{typeMetadata.GetIdentifier()},{otherTypeMetadata.GetIdentifier()},inherit,");
                        }

                    }
                    else if (typeSyntaxTreeText.Contains(otherTypeMetadata.TypeName))
                    {
                        if (!typeMetadata.TypeName.Contains(otherTypeMetadata.TypeName))
                        {
                            graphData.Add($"node,{otherTypeMetadata.GetIdentifier()},,,{otherTypeMetadata.TypeName},{otherTypeMetadata.TypeKind}");

                            graphData.Add($"edge,,{typeMetadata.GetIdentifier()},{otherTypeMetadata.GetIdentifier()},reference,");
                        }
                        else
                        {
                            if (
                                typeMetadata.Functions?.Exists(x => x.ReturnType == otherTypeMetadata.TypeName || 
                                x.ReturnType.StartsWith(otherTypeMetadata.TypeName + "<") || 
                                x.Parameters?.Exists(y => y.ParameterType == otherTypeMetadata.TypeName || y.ParameterType.StartsWith(otherTypeMetadata.TypeName + "<")) == true || 
                                x.FunctionBody?.Contains(otherTypeMetadata.TypeName) == true) == true)
                            {
                                graphData.Add($"node,{otherTypeMetadata.GetIdentifier()},,,{otherTypeMetadata.TypeName},{otherTypeMetadata.TypeKind}");
                                graphData.Add($"edge,,{typeMetadata.GetIdentifier()},{otherTypeMetadata.GetIdentifier()},reference,");
                            }
                        }
                    }
                }
            }

            // Check outside the current namespace for references to this namespace's types
            foreach (var otherNamespaceGroup in allFilesMetadata.Where(g => g.Key != namespacePath))
            {
                foreach (var otherTypeMetadata in otherNamespaceGroup.Value)
                {
                    if (otherTypeMetadata.Usings.Any(u => u.Contains(namespacePath.Replace(Path.DirectorySeparatorChar, '.'))))
                    {
                        string otherTypeSyntaxTreePath = Path.Combine(outputRootFolder, otherNamespaceGroup.Key, otherTypeMetadata.TypeName, "syntaxtree.txt");
                        string otherTypeSyntaxTreeText = File.ReadAllText(otherTypeSyntaxTreePath);

                        foreach (var typeMetadata in typesMetadata)
                        {

                            if (otherTypeMetadata.Properties.IsInherited && otherTypeMetadata.Properties.BaseTypeNames.Contains(typeMetadata.TypeName))
                            {
                                graphData.Add($"node,{otherTypeMetadata.GetIdentifier()},,,{otherTypeMetadata.TypeName},{otherTypeMetadata.TypeKind}");

                                if (typeMetadata.TypeKind == TypeKind.Interface)
                                {
                                    graphData.Add($"edge,,{otherTypeMetadata.GetIdentifier()},{typeMetadata.GetIdentifier()},implement,");
                                }
                                else
                                {
                                    graphData.Add($"edge,,{otherTypeMetadata.GetIdentifier()},{typeMetadata.GetIdentifier()},inherit,");
                                }
                            }
                                
                            else if (otherTypeSyntaxTreeText.Contains(typeMetadata.TypeName))
                            {
                                if (!otherTypeMetadata.TypeName.Contains(typeMetadata.TypeName))
                                {
                                    graphData.Add($"node,{otherTypeMetadata.GetIdentifier()},,,{otherTypeMetadata.TypeName},{otherTypeMetadata.TypeKind}");

                                    graphData.Add($"edge,,{otherTypeMetadata.GetIdentifier()},{typeMetadata.GetIdentifier()},reference,");
                                }
                                else
                                {
                                    if (otherTypeMetadata.Functions?.Exists(
                                        x => x.ReturnType == typeMetadata.TypeName || 
                                        x.ReturnType.StartsWith(typeMetadata.TypeName + "<") ||
                                        x.Parameters?.Exists(y => y.ParameterType == typeMetadata.TypeName || y.ParameterType.StartsWith(typeMetadata.TypeName + "<")) == true|| 
                                        x.FunctionBody?.Contains(typeMetadata.TypeName) == true) == true)
                                    {
                                        graphData.Add($"node,{otherTypeMetadata.GetIdentifier()},,,{otherTypeMetadata.TypeName},{otherTypeMetadata.TypeKind}");

                                        graphData.Add($"edge,,{otherTypeMetadata.GetIdentifier()},{typeMetadata.GetIdentifier()},reference,");
                                    }
                                }
                            }
                        }
                    }
                }
            }
            var distincted = graphData.Distinct().ToList();
            // Write the graph data to the CSV file
            File.WriteAllLines(graphFile, distincted);
        }
    }

    static async void CompileToDot(string file, DotGraph graph)
    {
        await using var writer = new StringWriter();
        var context = new CompilationContext(writer, new DotNetGraph.Compilation.CompilationOptions());
        await graph.CompileAsync(context);

        var result = writer.GetStringBuilder().ToString();

        // Save it to a file
        File.WriteAllText(file, result);
    }
}

// Metadata structure classes  
public class TypeMetadata
{
    public string FileName { get; set; }
    public string FilePath { get; set; }
    public TypeKind TypeKind { get; set; } // "class" or "interface"
    public string TypeName { get; set; }
    public string Namespace { get; set; }
    public List<string> Usings { get; set; } // List of using directives
    public PropertiesMetadata Properties { get; set; }
    public List<FunctionMetadata> Functions { get; set; }

    public string GetIdentifier() => string.Join('.', this.Namespace, this.TypeName);
}

public enum TypeKind
{
    Interface,
    Class,
    Struct
}


public class PropertiesMetadata
{
    public bool IsStatic { get; set; }
    public bool IsPrivate => false; // Assumption because it can be private on a member level, but not type level  
    public bool IsSealed { get; set; }
    public bool IsAbstract { get; set; }
    public bool HasNumeric { get; set; }
    public bool IsInherited { get; set; }
    public List<string> BaseTypeNames { get; set; }
}

public class FunctionMetadata
{
    public string FunctionName { get; set; }
    public string FunctionType { get; set; }
    public string ReturnType { get; set; }

    public string FunctionBody { get; set; }
    public List<ParameterMetadata> Parameters { get; set; }
}

public class ParameterMetadata
{
    public string ParameterType { get; set; }
    public string ParameterName { get; set; }
}
