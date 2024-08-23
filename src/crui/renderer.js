
document.getElementById('select-folder').addEventListener('click', async () => {
  const folderPaths = await window.electron.selectFolder();
  if (folderPaths.length > 0) {
    const folderPath = folderPaths[0];
    const { nodes, stats } = await displayDirectory(folderPath);
    console.log('Total Stats:', stats);
  }
});

document.getElementById('select-language').addEventListener('change', async (event) =>{
  const selectedLanguage = event.target.value;
  await window.electron.sendLanguageChoice(selectedLanguage);
})

async function displayDirectory(folderPath) {
  const directoryItems = await window.electron.readDirectory(folderPath);
  const { nodes, stats } = await buildTreeData(directoryItems);
  let rootNode = [{
    text: folderPath,
    id: folderPath,
    icon: 'jstree-folder',
    children: nodes
  }];
  $('#folder-tree').jstree(true).settings.core.data = rootNode;
  $('#folder-tree').jstree(true).refresh();
  return { nodes, stats };
}

async function buildTreeData(items, path = '') {
  let totalFileCount = 0;
  let totalFolderCount = 0;
  let totalCodeFileCount = 0;
  let totalCodeFileLineCount = 0;

  const nodes = [];
  for (const item of items) {
    const fullPath = path ? `${path}/${item.name}` : item.path;
    let node = {
      text: item.name,
      id: fullPath,
      icon: item.isDirectory ? 'jstree-folder' : 'jstree-file',
      children: item.isDirectory ? await buildTreeData(await window.electron.readDirectory(fullPath), fullPath).then(result => {
        totalFileCount += result.stats.totalFileCount;
        totalFolderCount += result.stats.totalFolderCount;
        totalCodeFileCount += result.stats.totalCodeFileCount;
        totalCodeFileLineCount += result.stats.totalCodeFileLineCount;
        return result.nodes;
      }) : false
    };

    if (item.isDirectory) {
      totalFolderCount++;
    } else {
      totalFileCount++;
      if (isSourceCodeFile(item.name)) {
        totalCodeFileCount++;
        const lineCount = await countFileLines(fullPath);
        totalCodeFileLineCount += lineCount;
        node.lineCount = lineCount;
      }
    }

    nodes.push(node);
  }

  return {
    nodes,
    stats: {
      totalFileCount,
      totalFolderCount,
      totalCodeFileCount,
      totalCodeFileLineCount
    }
  };
}

function isSourceCodeFile(fileName) {
  const sourceCodeExtensions = ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.cs', '.html', '.css']; // Add more extensions as needed
  const extension = fileName.slice(fileName.lastIndexOf('.'));
  return sourceCodeExtensions.includes(extension);
}

async function countFileLines(filePath) {
  const content = await window.electron.readFile(filePath);
  return content.split('\n').length;
}


function displayStats(stats) {
  const contentContainer = document.getElementById('file-content1');
  contentContainer.innerHTML = `
    <p>Total Files: ${stats.totalFileCount}</p>
    <p>Total Folders: ${stats.totalFolderCount}</p>
    <p>Total Code Files: ${stats.totalCodeFileCount}</p>
    <p>Total Code File Lines: ${stats.totalCodeFileLineCount}</p>
  `;
}

function isDotFile(fileName) {
  return fileName.endsWith('.dot');
}

function isCsvFile(fileName) {
  return fileName.endsWith('.csv');
}

function isJsonFile(fileName) {
  return fileName.slice(fileName.lastIndexOf('.')) === '.json';
}

async function displayInteractDot() {
  const contentContainer = document.getElementById('file-content1');
  contentContainer.innerHTML = ''; // Clear the content container
  cytoscape.use(cytoscapeDagre);

  const cy = cytoscape({
    container: document.getElementById('file-content1'),

    layout: {
      name: 'dagre'
    },

    style: [
      {
        selector: 'node',
        style: {
          'width': 20,
          'background-color': '#666',
          'label': 'data(id)'
        }
      },
      {
        selector: 'edge',
        style: {
          'width': 3,
          'line-color': '#ccc',
          'target-arrow-color': '#ccc',
          'target-arrow-shape': 'triangle'
        }
      }
    ],

    elements: {
      nodes: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'c' } }
      ],
      edges: [
        { data: { source: 'a', target: 'b' } },
        { data: { source: 'a', target: 'c' } }
      ]
    }
  });

  // Enable dragging nodes
  cy.on('tap', 'node', function (event) {
    const node = event.target;
    console.log('Clicked node:', node.id());
    // Trigger customized actions here
  });

  // Enable dragging
  cy.on('drag', 'node', function (event) {
    const node = event.target;
    console.log('Dragging node:', node.id());
    // Handle dragging behavior here
  });
}
async function displayFolderBasicInfo(filePath) {
  const content = await window.electron.readFile(filePath);
  const treeData = JSON.parse(content);
  const contentContainer = document.getElementById('file-content1');
  contentContainer.innerHTML = ''; // Clear the content container


  const totalCodeFileLineCount = treeData.total_source_lines;


  const margin = { top: 20, right: 20, bottom: 20, left: 20 };
  const buffer = 10;
  const width = contentContainer.clientWidth - margin.left - margin.right - buffer;
  const height = contentContainer.clientHeight - margin.top - margin.bottom - buffer;

  // Append the svg object to the body of the page
  const svg = d3.select(contentContainer).append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  let i = 0,
    duration = 750,
    root;

  // Declares a tree layout and assigns the size
  const treemap = d3.tree().size([width, height]); // Swap width and height

  // Assigns parent, children, height, depth
  root = d3.hierarchy(treeData, d => d.children);
  root.x0 = width / 2; // Adjusted for x-direction
  root.y0 = 0;

  if (root.children) {
    root.children.forEach(collapse);
  }
  // Collapse after the second level
  // root.children.forEach(collapse);

  update(root);

  // Collapse the node and all it's children
  function collapse(d) {
    if (d.children) {
      d._children = d.children;
      d._children.forEach(collapse);
      d.children = null;
    }
  }

  function update(source) {
    // Assigns the x and y position for the nodes
    const treeData = treemap(root);

    // Compute the new tree layout.
    const nodes = treeData.descendants(),
      links = treeData.descendants().slice(1);

    // Normalize for fixed-depth.
    nodes.forEach(d => { d.y = d.depth * 180 });

    // ****************** Nodes section ***************************

    // Update the nodes...
    const node = svg.selectAll('g.node')
      .data(nodes, d => d.id || (d.id = ++i));

    // Enter any new modes at the parent's previous position.
    const nodeEnter = node.enter().append('g')
      .attr('class', 'node')
      .attr("transform", d => "translate(" + source.x0 + "," + source.y0 + ")") // Swap x and y
      .on('click', click);

    // Add Circle for the nodes
    nodeEnter.append('circle')
      .attr('class', 'node')
      .attr('r', 1e-6)
      .style("fill", d => d._children ? "lightsteelblue" : "#fff");

    // // Add labels for the nodes
    // nodeEnter.append('text')
    //   .attr("dy", ".35em")
    //   .attr("x", d => d.children || d._children ? -13 : 13)
    //   .attr("text-anchor", d => d.children || d._children ? "end" : "start")
    //   .text(d => d.data.name);

    // // Add tooltip for the nodes
    nodeEnter.append('title')
      .text(d => `folder: ${d.data.name}\nFolder Count: ${d.data.total_folders}\nFile Count: ${d.data.total_files}\nCode File Count: ${d.data.total_source_files}\nCode File Lines: ${d.data.total_source_lines}`);

    // UPDATE
    const nodeUpdate = nodeEnter.merge(node);

    // Transition to the proper position for the node
    nodeUpdate.transition()
      .duration(duration)
      .attr("transform", d => "translate(" + d.x + "," + d.y + ")"); // Swap x and y

    // Update the node attributes and style
    nodeUpdate.select('circle.node')
      .attr('r', d => Math.sqrt(d.data.total_source_lines / totalCodeFileLineCount * 100)) // Set radius based on count
      .style("fill", d => d._children ? "lightsteelblue" : "#fff")
      .attr('cursor', 'pointer');

    // Remove any exiting nodes
    const nodeExit = node.exit().transition()
      .duration(duration)
      .attr("transform", d => "translate(" + source.x + "," + source.y + ")") // Swap x and y
      .remove();

    // On exit reduce the node circles size to 0
    nodeExit.select('circle')
      .attr('r', 1e-6);

    // On exit reduce the opacity of text labels
    nodeExit.select('text')
      .style('fill-opacity', 1e-6);

    // ****************** links section ***************************

    // Update the links...
    const link = svg.selectAll('path.link')
      .data(links, d => d.id);

    // Enter any new links at the parent's previous position.
    const linkEnter = link.enter().insert('path', "g")
      .attr("class", "link")
      .attr('d', d => {
        const o = { x: source.x0, y: source.y0 };
        return diagonal(o, o);
      });

    // UPDATE
    const linkUpdate = linkEnter.merge(link);

    // Transition back to the parent element position
    linkUpdate.transition()
      .duration(duration)
      .attr('d', d => diagonal(d, d.parent));

    // Remove any exiting links
    const linkExit = link.exit().transition()
      .duration(duration)
      .attr('d', d => {
        const o = { x: source.x, y: source.y };
        return diagonal(o, o);
      })
      .remove();

    // Store the old positions for transition.
    nodes.forEach(d => {
      d.x0 = d.x;
      d.y0 = d.y;
    });

    // Creates a curved (diagonal) path from parent to the child nodes
    function diagonal(s, d) {
      const path = `M ${s.x} ${s.y}
                          C ${s.x} ${(s.y + d.y) / 2},
                            ${d.x} ${(s.y + d.y) / 2},
                            ${d.x} ${d.y}`;
      return path;
    }

    // Toggle children on click.
    function click(event, d) {
      if (d.children) {
        d._children = d.children;
        d.children = null;
      } else {
        d.children = d._children;
        d._children = null;
      }
      update(d);
    }
  }
}


$(function () {
  $('#folder-tree').jstree({
    'core': {
      'data': [],
      'check_callback': true
    },
    'plugins': ['wholerow']
  }).on('select_node.jstree', function (e, data) {
    const node = data.node;
    if (node.original && node.original.icon === 'jstree-folder') {
      displayAnalysisInfo(node.id);

    } else if (node.original && node.original.icon === 'jstree-file') {
      const filePath = node.id;

      displayFileAnalysis(filePath);

    }
  });

  $.contextMenu({
    selector: '#folder-tree .jstree-node',
    build: function ($trigger, e) {
      const node = $('#folder-tree').jstree(true).get_node($trigger);
      return {
        items: {
          analyze: {
            name: "Analysis from here",
            callback: function () {
              analyzeFromHere(node.id);
            }
          }
        }
      };
    }
  });
});


$(function () {
  $('#folder-tree').jstree({
    'core': {
      'data': [],
      'check_callback': true
    },
    'plugins': ['wholerow']
  }).on('select_node.jstree', function (e, data) {
    const node = data.node;
    if (node.original && node.original.icon === 'jstree-folder') {
      displayAnalysisInfo(node.id);

    } else if (node.original && node.original.icon === 'jstree-file') {
      const filePath = node.id;

      displayFileAnalysis(filePath);

    }
  });

  $.contextMenu({
    selector: '#folder-tree .jstree-node',
    build: function ($trigger, e) {
      const node = $('#folder-tree').jstree(true).get_node($trigger);
      return {
        items: {
          analyze: {
            name: "Analysis from here",
            callback: function () {
              analyzeFromHere(node.id);
            }
          }
        }
      };
    }
  });
});



async function analyzeFromHere(folderPath) {
  await window.electron.runAnalysis(folderPath);
  const analysisInfo = await window.electron.getAnalysisInfo(folderPath);
}

async function displayAnalysisInfo(folderPath) {
  const analysisInfo = await window.electron.getAnalysisInfo(folderPath);
  const contentContainer = document.getElementById('file-content1');
  if (analysisInfo.error) {
    contentContainer.textContent = analysisInfo.error;
  } else {
    displayFolderBasicInfo(analysisInfo.folder_info_path, analysisInfo.isCsharp);
    await displayGraphvizFile(analysisInfo.package_dep_info_path);
    await displayPngFile(analysisInfo.folder_call_graph_info_path, analysisInfo.isCsharp);
  }
}

async function displayPngFile(filePath, isCsharp = false) {
  if(isCsharp){
    // Clear the container as we don't need file-content1 for csharp scenario.
    const contentContainer = document.getElementById('file-content3');
    contentContainer.innerHTML = '';
    contentContainer.textContent = 'No content in file-content3 for c# scenario';
    return;
  }
  const contentContainer = document.getElementById('file-content3');
  contentContainer.innerHTML = ''; // Clear the content container

  const imgElement = document.createElement('img');
  imgElement.src = filePath;
  imgElement.style.width = '100%';
  imgElement.style.height = '100%';
  imgElement.style.objectFit = 'contain'; // To fit the image within the container
  imgElement.style.transformOrigin = 'center center'; // To ensure the zoom happens from the center

  contentContainer.appendChild(imgElement);

  let zoomLevel = 1;

  imgElement.addEventListener('wheel', (event) => {
    event.preventDefault();
    if (event.deltaY < 0) {
      // Zoom in
      zoomLevel += 0.1;
    } else {
      // Zoom out
      zoomLevel -= 0.1;
      if (zoomLevel < 0.1) {
        zoomLevel = 0.1;
      }
    }
    imgElement.style.transform = `scale(${zoomLevel})`;
  });

  //create a new button for source png
  const openFolderButton = document.createElement('button')
  openFolderButton.textContent = 'Open Folder to Get Source Picture';
  openFolderButton.computedStyleMap.marginTop = '10px';
  //add the button to contentContainer
  contentContainer.appendChild(openFolderButton);

  // add event for click the button
  openFolderButton.addEventListener('click', ()=>{
    console.log("Button clicked!"); 
    openFolder(filePath);
  })
}

async function displayFileAnalysis(filePath) {
  displayFileContent(filePath);
  displayFileFunctions(filePath);

}

async function displayFileFunctions(filePath) {
  const fileAnalysisInfo = await window.electron.getFileAnalysisInfo(filePath);

  if (fileAnalysisInfo.error) {
    console.error(fileAnalysisInfo.error);
    return;
  }

  const fileAnalysisInfoPath = fileAnalysisInfo.file_code_info_path;
  const content = await window.electron.readFile(fileAnalysisInfoPath);
  const functionData = JSON.parse(content);
  const tableData = functionData.functions.map(func => {
    if (func.name.lastIndexOf('.') === -1) {
      return {
        classname: '',
        functionName: func.name,
        access: func.access
      };
    }
    else {
      const [classname, functionName] = func.name.split('.');
      return {
        classname: classname,
        functionName: functionName,
        access: func.access
      };
    }
  });
  const tableContainer = d3.select("#file-content2");
  tableContainer.html(""); // Clear the content container

  const table = tableContainer.append("table");
  const thead = table.append("thead");
  const tbody = table.append("tbody");

  // Add table header
  thead.append("tr")
    .selectAll("th")
    .data(["Classname", "Function Name", "Access", "Operation"])
    .enter()
    .append("th")
    .text(d => d);

  // Add table rows
  const rows = tbody.selectAll("tr")
    .data(tableData)
    .enter()
    .append("tr");

  rows.append("td").text(d => d.classname);
  rows.append("td").text(d => d.functionName);
  rows.append("td").text(d => d.access);
  rows.append("td").append("button")
    .text("callstack")
    .on("click", (event, d) => {
      processFunctionCallstack(d.functionName);
      processInternalFunctionCallstack(filePath, d.functionName);
    });
}

async function processFunctionCallstack(functionName) {
  const callstackPath = await window.electron.getFunctionCallStackAnalysis(functionName);
  displayPngFile(callstackPath.call_stack_path);
  // console.log(`Classname: ${d.classname}, Function Name: ${d.functionName}`);

}
async function processInternalFunctionCallstack(filePath, functionName) {
  const internalCallStackResult = await window.electron.getFunctionInternalCallStackAnalysis(filePath, functionName);
  displayInternalCallJson(internalCallStackResult.internal_call_graph_path, internalCallStackResult.relative_path, functionName, internalCallStackResult.global_folder_path);
  // console.log(`Classname: ${d.classname}, Function Name: ${d.functionName}`);

}

async function displayInternalCallJson(filePath, target_root_file, target_root_function, global_folder_path) {
  const content = await window.electron.readFile(filePath);
  const contentContainer = document.getElementById('file-content4');
  contentContainer.innerHTML = ``;

  const margin = { top: 20, right: 20, bottom: 20, left: 20 };
  const buffer = 10;
  const width = contentContainer.clientWidth - margin.left - margin.right - buffer;
  const height = contentContainer.clientHeight - margin.top - margin.bottom - buffer;

  const data = JSON.parse(content);
  const svg = d3.select(contentContainer).append("svg")
    .attr("width", 1200)
    .attr("height", 800),
    g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  const root = {
    name: target_root_function,
    file: target_root_file,
    fullPath: global_folder_path + "\\" + target_root_file,
    children: buildTree(target_root_file + ":" + target_root_function)
  };

  function buildTree(key) {
    if (!data[key]) 
      return [];
  
    var result = [];
    for (var i = 0; i < data[key].length; i++) {
      var item = data[key][i];
      var treeNode = {
        name: item.name,
        file: item.file,
        fullPath: global_folder_path + "\\" + item.file,
        lineno: item.lineno,
        children: buildTree(item.file + ":" + item.name)
      };
      result.push(treeNode);
    }
  
    return result;
  }


  const tree = d3.tree().size([height, width - 160]),
    stratify = d3.stratify().parentId(d => d.id.substring(0, d.id.lastIndexOf(".")));

  const rootNode = d3.hierarchy(root);

  tree(rootNode);

  const link = g.selectAll(".link")
    .data(rootNode.descendants().slice(1))
    .enter().append("path")
    .attr("class", "link")
    .attr("d", d => `
          M${d.y},${d.x}
          C${(d.y + d.parent.y) / 2},${d.x}
           ${(d.y + d.parent.y) / 2},${d.parent.x}
           ${d.parent.y},${d.parent.x}
      `);


      const node = g.selectAll(".node")
      .data(rootNode.descendants())
      .enter().append("g")
      .attr("class", d => "node" + (d.children ? " node--internal" : " node--leaf"))
      .attr("transform", d => `translate(${d.y},${d.x})`);

  node.append("circle")
      .attr("r", 5);

  node.append("text")
      .attr("dy", 3)
      .attr("x", d => d.children ? -8 : 8)
      .style("text-anchor", d => d.children ? "end" : "start")
      .html(d => `${d.data.lineno}: <a href="#" onclick="locateFile('${encodeURIComponent(d.data.fullPath)}', '${d.data.name}')">${d.data.name}</a> (${d.data.file})`);


}

async function locateFile(encodedPath, functionName) {
  const decodedPath = decodeURIComponent(encodedPath);
  displayFileAnalysis(decodedPath);
}
async function displayFileContent(filePath) {
  const content = await window.electron.readFile(filePath);
  const contentContainer = document.getElementById('file-content1');

  // Determine the language for syntax highlighting
  const fileExtension = filePath.split('.').pop();
  let language = 'markup';
  switch (fileExtension) {
    case 'js':
      language = 'javascript';
      break;
    case 'py':
      language = 'python';
      break;
    case 'java':
      language = 'java';
      break;
    // Add more cases as needed for other languages
  }

  // Set the content with syntax highlighting
  contentContainer.innerHTML = `<pre><code class="language-${language}">${Prism.highlight(content, Prism.languages[language], language)}</code></pre>`;
}
async function displayGraphvizFile(filePath) {
  try {
    const content = await window.electron.readFile(filePath); // read graph.gv
    const contentContainer = document.getElementById('file-content2');
    contentContainer.innerHTML = ''; // clean container
    const svg = await window.electron.vizRender(content);
    console.log('Generated SVG:', svg);
    contentContainer.innerHTML = svg;  // insert svg

    //create a new button for source png
    const openFolderButton = document.createElement('button')
    openFolderButton.textContent = 'Open Folder to Get Source Picture';
    openFolderButton.computedStyleMap.marginTop = '10px';

    //add the button to contentContainer
    contentContainer.appendChild(openFolderButton);

    // add event for click the button, open png file location.
    openFolderButton.addEventListener('click', ()=>{
      console.log("Button clicked!"); 
      const pngFilePath = filePath.replace(/graph\.gv$/, 'graph.png');
      openFolder(pngFilePath);
    })
  } catch (error) {
      console.error('Error rendering GV file:', error);
      contentContainer.textContent = 'Failed to render the GV file.';
  }
}

async function openFolder(filePath){
  try
  {
    console.log(`Original filePath: ${filePath}`); 
    await window.electron.showItemInFolder(filePath);
  }
  catch (error) {
    console.error("Error in OpenFolder", error);
  }
}