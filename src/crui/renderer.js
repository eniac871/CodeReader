

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
  const contentContainer = document.getElementById('file-content');
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



async function displayJsonFile(filePath) {
  const content = await window.electron.readFile(filePath);
  const jsonData = JSON.parse(content);
  const contentContainer = document.getElementById('file-content');
  contentContainer.innerHTML = ''; // Clear the content container

  const width = contentContainer.clientWidth;
  const height = contentContainer.clientHeight;

  const root = d3.hierarchy(jsonData);


  const treeLayout = d3.tree().size([width, height - 100]);
  treeLayout(root);

  const svg = d3.select(contentContainer).append('svg')
    .attr('width', width)
    .attr('height', height);

  const link = svg.append('g')
    .selectAll('line')
    .data(root.links())
    .enter().append('line')
    .attr('stroke', '#555')
    .attr('stroke-width', 2)
    .attr('x1', d => d.source.x)
    .attr('y1', d => d.source.y + 50)
    .attr('x2', d => d.target.x)
    .attr('y2', d => d.target.y + 50);

  const node = svg.append('g')
    .selectAll('circle')
    .data(root.descendants())
    .enter().append('circle')
    .attr('cx', d => d.x)
    .attr('cy', d => d.y + 50)
    .attr('r', d => Math.sqrt(d.data.total_source_lines/1000) * 2) // Adjust the size based on the total_files
    .attr('fill', d => d.children ? '#555' : '#999');

  const text = svg.append('g')
    .selectAll('text')
    .data(root.descendants())
    .enter().append('text')
    .attr('x', d => d.x)
    .attr('y', d => d.y + 45)
    .attr('dy', '0.35em')
    .attr('text-anchor', 'middle')
    .text(d => d.data.name );

  node.on('click', function(event, d) {
    displayStats(d.data);
  });
}
$(function() {
  $('#folder-tree').jstree({
    'core': {
      'data': [],
      'check_callback': true
    },
    'plugins': ['wholerow']
  }).on('select_node.jstree', function(e, data) {
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

      displayFileContent(filePath);
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
    build: function($trigger, e) {
      const node = $('#folder-tree').jstree(true).get_node($trigger);
      return {
        items: {
          analyze: {
            name: "Analysis from here",
            callback: function() {
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
}

async function displayAnalysisInfo(folderPath) {
  const analysisInfo = await window.electron.getAnalysisInfo(folderPath);
  const contentContainer = document.getElementById('file-content');
  if (analysisInfo.error) {
    contentContainer.textContent = analysisInfo.error;
  } else {
    displayJsonFile(analysisInfo.folder_info_path);
    displayCsvFile(analysisInfo.package_dep_info_path);
    displayPngFile(analysisInfo.folder_call_graph_info_path);
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

async function displayFileContent(filePath) {
  const content = await window.electron.readFile(filePath);
  const contentContainer = document.getElementById('file-content');

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
      nodes.push({ id: source, name: parts[parts.length-1] });
      nodeSet.add(source);
    }

    if (type === 'Edge') {
      links.push({ source, target });
    }
  }

  return { nodes, links };
}
