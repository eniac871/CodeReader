const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');

let mainWindow;
let globalFolderPath = '';
let globalOutputDir = '';

app.on('ready', () => {
  mainWindow = new BrowserWindow({
    width: 2560,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),      
      nodeIntegration: true,
      contextIsolation: true,
      enableRemoteModule: false,
    }
  });

  mainWindow.loadFile('index.html');

  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    return result.filePaths;
  });

  ipcMain.handle('read-directory', async (event, directoryPath) => {
    const items = fs.readdirSync(directoryPath).map(name => {
      const fullPath = path.join(directoryPath, name);
      return {
        name,
        path: fullPath,
        isDirectory: fs.lstatSync(fullPath).isDirectory()
      };
    });
    return items;
  });

  ipcMain.handle('read-file', async (event, filePath) => {
    return fs.readFileSync(filePath, 'utf-8');
  });

  ipcMain.handle('run-analysis', async (event, folderPath) => {
    const userHomeDir = os.homedir();
    const appRoot = path.join(userHomeDir, '.code-analyzer', 'temp');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputDir = path.join(appRoot, 'analysis_output', timestamp);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const command = `conda activate repo_advisor && python C:\\Users\\anthu\\projects\\code2flow\\repo_advisor\\src\\python\\folder_dependency\\main_invoker.py "${folderPath}" "${outputDir}"`;
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing command: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`Error: ${stderr}`);
        return;
      }
      console.log(`Output: ${stdout}`);
    });

    globalFolderPath = folderPath;
    globalOutputDir = outputDir;
  });

  ipcMain.handle('get-analysis-info', async (event, subfolderPath) => {
    if (!globalFolderPath || !globalOutputDir) {
      return { error: 'Analysis has not been run yet.' };
    }

    const relativePath = path.relative(globalFolderPath, subfolderPath);
    const analysisFolderInfoFile = path.join(globalOutputDir, 'folder_info', relativePath + '\\info.json');
    const analysisPackageDepInfoFile = path.join(globalOutputDir, 'folder_package_dep_info', relativePath + '\\graph.csv');
    const analysisFolderCallGraphInfoFile = path.join(globalOutputDir, 'folder_call_graph_info', relativePath + '\\call_graph.png');

    if (fs.existsSync(analysisFolderInfoFile) || fs.existsSync(analysisPackageDepInfoFile)) {
      return { folder_info_path: analysisFolderInfoFile, package_dep_info_path: analysisPackageDepInfoFile , folder_call_graph_info_path: analysisFolderCallGraphInfoFile};
    } else {
      return { error: 'Analysis info not found.' };
    }
  });

 
});
