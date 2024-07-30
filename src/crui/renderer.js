
document.getElementById('select-folder').addEventListener('click', async () => {
  const folderPaths = await window.electron.selectFolder();
  if (folderPaths.length > 0) {
    const folderPath = folderPaths[0];
    const { nodes, stats } = await displayDirectory(folderPath);
    console.log('Total Stats:', stats);
  }
});

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

  // const rootAnalysisInfo = await window.electron.getRootAnalysisInfo();
  // const totalCodeFileLineCount = rootAnalysisInfo.total_source_lines;
  const width = contentContainer.clientWidth;
  const height = contentContainer.clientHeight;
  const totalCodeFileLineCount = treeData.total_source_lines;



  const margin = { top: 20, right: 90, bottom: 30, left: 90 };
  // width = 960 - margin.left - margin.right,
  // height = 500 - margin.top - margin.bottom;

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

    // Add labels for the nodes
    nodeEnter.append('text')
      .attr("dy", ".35em")
      .attr("x", d => d.children || d._children ? -13 : 13)
      .attr("text-anchor", d => d.children || d._children ? "end" : "start")
      .text(d => d.data.name);

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
      // window.electron.readDirectory(node.id).then(items => {
      //   return buildTreeData(items).then(result => {
      //     displayStats(result.stats);
      //   });
      // });
    } else if (node.original && node.original.icon === 'jstree-file') {
      const filePath = node.id;

      displayFileAnalysis(filePath);
      // if (isCsvFile(filePath)) {
      //   displayCsvFile(filePath);
      // } else if (isJsonFile(filePath)) {
      //   displayJsonFile(filePath);
      // } else {
      //   displayFileContent(filePath);
      // }
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
    // displayJsonFile(analysisInfo.folder_info_path);
    displayFolderBasicInfo(analysisInfo.folder_info_path);
    displayCsvFile(analysisInfo.package_dep_info_path);
    displayPngFile(analysisInfo.folder_call_graph_info_path);
    // displayInteractDot();
  }
}

async function displayPngFile(filePath) {
  // const content = await window.electron.readFile(filePath);
  const contentContainer = document.getElementById('file-content3');
  contentContainer.innerHTML = ''; // Clear the content container

  const imgElement = document.createElement('img');
  imgElement.src = filePath;
  contentContainer.appendChild(imgElement);
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
    });
}

async function processFunctionCallstack(functionName) {
  const callstackPath = await window.electron.getFunctionCallStackAnalysis(functionName);
  displayPngFile(callstackPath.call_stack_path);
  // console.log(`Classname: ${d.classname}, Function Name: ${d.functionName}`);

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
async function displayCsvFile(filePath) {
  const content = await window.electron.readFile(filePath);
  const contentContainer = document.getElementById('file-content2');
  contentContainer.innerHTML = ''; // Clear the content container

  const graph = parseCsv(content);

  const width = contentContainer.clientWidth - 20;
  const height = contentContainer.clientHeight - 20;

  const svg = d3.select('#file-content2').append('svg')
    .attr('width', width)
    .attr('height', height);

  // Define the arrow marker
  svg.append('defs').append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '-0 -5 10 10')
    .attr('refX', 13)
    .attr('refY', 0)
    .attr('orient', 'auto')
    .attr('markerWidth', 13)
    .attr('markerHeight', 13)
    .attr('xoverflow', 'visible')
    .append('svg:path')
    .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
    .attr('fill', '#999')
    .style('stroke', 'none');

  const link = svg.append('g')
    .selectAll('line')
    .data(graph.links)
    .enter().append('line')
    .attr('stroke-width', 1)
    .attr('stroke', '#999')
    .attr('marker-end', 'url(#arrowhead)');

  const node = svg.append('g')
    .selectAll('circle')
    .data(graph.nodes)
    .enter().append('circle')
    .attr('r', 5)
    .attr('fill', '#69b3a2')

  const labels = svg.append('g')
    .selectAll('text')
    .data(graph.nodes)
    .enter().append('text')
    .attr('dy', -10)
    .attr('dx', 10)
    .text(d => d.name);


  const simulation = d3.forceSimulation(graph.nodes)
    .force('link', d3.forceLink(graph.links).id(d => d.id))
    .force('charge', d3.forceManyBody().strength(-400))
    .force('center', d3.forceCenter(width / 2, height / 2));
  // .force('y', d3.forceY().strength(1.5).y(d => d.depth * 1000)); // Force nodes to be positioned vertically

  simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    node
      .attr('cx', d => d.x)
      .attr('cy', d => d.y);

    labels
      .attr('x', d => d.x)
      .attr('y', d => d.y);
  });
}

function parseCsv(csvContent) {
  const lines = csvContent.split('\n').filter(line => line.trim() !== '');
  const headers = lines[0].split(',');
  const nodes = [];
  const links = [];
  const nodeSet = new Set();

  for (let i = 1; i < lines.length; i++) {
    const data = lines[i].split(',');
    const type = data[0];
    const source = data[1];
    const target = data[2];

    if (type === 'Node' && !nodeSet.has(source)) {
      const parts = source.split('.');
      nodes.push({ id: source, name: parts[parts.length - 1] });
      nodeSet.add(source);
    }

    if (type === 'Edge') {
      links.push({ source, target });
    }
  }

  return { nodes, links };
}
