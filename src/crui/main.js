const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);


let mainWindow;
let globalFolderPath = '';
let globalOutputDir = '';
global.selectedLanguage = null;

app.on('ready', () => {
  mainWindow = new BrowserWindow({
    width: 2560,
    height: 1280,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),      
      nodeIntegration: true,
      contextIsolation: true,
      enableRemoteModule: false
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

    const runDotnetAnalysis = () => {
      return new Promise((resolve, reject) => {
          const csharpDir = path.join(outputDir, 'folder_package_dep_info');
          const dotnetCommand = `dotnet run --project ..\\csharp\\ast_parser\\Utilities\\Utilities.csproj ${folderPath} ${csharpDir}`;
          exec(dotnetCommand, { maxBuffer: 1024*1024*10 }, (error, stdout, stderr) => {
              if (error) {
                  console.error(`Error executing dotnet command: ${error.message}`);
                  reject(error);
                  return;
              }
              console.log(`Dotnet Output: ${stdout}`);
              if (stderr) {
                  console.warn(`Dotnet Stderr: ${stderr}`);
              }
              resolve({ stdout, stderr });
          });
      });
    };

    const runGeneralAnalysis = () => {
      return new Promise((resolve, reject) => {
          if (global.selectedLanguage == 'csharp') {
            const csharpDir = path.join(outputDir, 'folder_package_dep_info');
            // the input is outputDir/csharpcsv, output should be root folder to align with python analyser
            command = `conda activate repo_advisor && python ..\\python\\folder_dependency\\main_invoker.py -s "${folderPath}" -o "${outputDir}" -l csharp -c "${csharpDir}"`;
          }
          else {
            command = `conda activate repo_advisor && python ..\\python\\folder_dependency\\main_invoker.py  -s "${folderPath}" -o "${outputDir}"`;
          }
          exec(command, { maxBuffer: 1024*1024*10 }, (error, stdout, stderr) => {
              if (error) {
                  console.error(`Error executing command: ${error.message}`);
                  if(global.selectedLanguage != 'csharp') {
                    // Ignore error for csharp scenario temporarily as we already known it's caused by filename path too long.
                    reject(error);
                  }
                  resolve({ stdout, stderr, error });
                  return;
              }
              console.log(`Output: ${stdout}`);
              if (stderr) {
                  console.warn(`Stderr: ${stderr}`);
              }
              resolve({ stdout, stderr });
          });
      });
    };
    
    console.log(outputDir);
    globalFolderPath = folderPath;
    globalOutputDir = outputDir;
    if(global.selectedLanguage == 'csharp')
    {
      const csharpResult = await runDotnetAnalysis();
      await runGeneralAnalysis();
      return { folderPath, outputDir, csharpResult};
    }
    else
    {
      const result = await runGeneralAnalysis();
      return {folderPath, outputDir, result};
    }

  });

  ipcMain.handle('function-internal-call-graph-analysis', async (event, filePath, functionName) => {
    if (!globalFolderPath || !globalOutputDir) {
      return { error: 'Analysis has not been run yet.' };
    }
    const relativePath = path.relative(globalFolderPath, filePath);
    const filePathWithoutExtension = relativePath.replace('.py', '');
    const astFolderPath = path.join(globalOutputDir, "ast_info");
    const resultPath = path.join(globalOutputDir, "internal-call-graph", filePathWithoutExtension + functionName + '.json');
  
    if (!fs.existsSync(resultPath)) {
      const command = `conda activate repo_advisor && python ..\\python\\folder_dependency\\python_call_stack_generator.py -a "${astFolderPath}" -f "${relativePath}" -m "${functionName}" -o "${resultPath}"`;
      console.log(command);
  
      try {
        await execPromise(command);
      } catch (error) {
        console.error(`Error executing command: ${error.message}`);
        return { error: `Error executing command: ${error.message}` };
      }
    }
  
    return { internal_call_graph_path: resultPath, relative_path: relativePath, global_folder_path: globalFolderPath };
  });


  ipcMain.handle('function-call-stack-analysis', async (event, function_name) => {
    if (!globalFolderPath || !globalOutputDir) {
      return { error: 'Analysis has not been run yet.' };
    }
  
    const callstackPath = path.join(globalOutputDir, function_name + '.png');
  
    if (!fs.existsSync(callstackPath)) {
      const command = `conda activate repo_advisor && python ..\\python\\folder_dependency\\main_invoker.py -s "${globalFolderPath}" -o "${globalOutputDir}" -t "${function_name}"`;
      console.log(command);
  
      try {
        const { stdout, stderr } = await execPromise(command);
        if (stderr) {
          console.error(`Error: ${stderr}`);
          return { error: `Error: ${stderr}` };
        }
        console.log(`Output: ${stdout}`);
      } catch (error) {
        console.error(`Error executing command: ${error.message}`);
        return { error: `Error executing command: ${error.message}` };
      }
    }
  
    return { call_stack_path: callstackPath };
  });

  ipcMain.handle('get-analysis-info', async (event, subfolderPath) => {
    if (!globalFolderPath || !globalOutputDir) {
      return { error: 'Analysis has not been run yet.' , package_dep_info_path: analysisPackageDepInfoFile};
    }

    const relativePath = path.relative(globalFolderPath, subfolderPath);
    const analysisFolderInfoFile = path.join(globalOutputDir, 'folder_info', relativePath + '\\info.json');
    const analysisPackageDepInfoFile = path.join(globalOutputDir, 'folder_package_dep_info', 'folder_package_dep_info', relativePath + '\\graph.gv');
    const analysisFolderCallGraphInfoFile = path.join(globalOutputDir, 'folder_call_graph_info', relativePath + '\\call_graph.png');

    if (fs.existsSync(analysisFolderInfoFile) || fs.existsSync(analysisPackageDepInfoFile)) {
      if(global.selectedLanguage=='csharp') {
        return {folder_info_path: analysisFolderInfoFile, package_dep_info_path: analysisPackageDepInfoFile, isCsharp: true};
      }
      else
      {
        return { folder_info_path: analysisFolderInfoFile, package_dep_info_path: analysisPackageDepInfoFile , folder_call_graph_info_path: analysisFolderCallGraphInfoFile};
      }
    } else {
      return { error: 'Analysis info not found.', package_dep_info_path: analysisPackageDepInfoFile};
    }
  });

  ipcMain.handle('get-file-analysis-info', async (event, filePath) => {
    if (!globalFolderPath || !globalOutputDir) {
      return { error: 'Analysis has not been run yet.' };
    }

    const relativePath = path.relative(globalFolderPath, filePath);
    const relativeFolderPath = path.dirname(relativePath);
    const fileName = path.basename(filePath).replace('.py', '');
    const analysisFileInfoFile = path.join(globalOutputDir, 'code_info', relativeFolderPath + `\\${fileName}.json`);

    if (fs.existsSync(analysisFileInfoFile)) {
      return { file_code_info_path: analysisFileInfoFile};
    } else {
      return { error: 'Analysis info not found.' };
    }
  });

  ipcMain.handle('show-item-in-folder', async (event, filePath) => {
    console.log(`Opening folder and showing item: ${filePath}`);
    shell.showItemInFolder(filePath);
  });

  ipcMain.handle('send-language-choice', async (event, language) => {
    console.log(`Selected language: ${language}`);
    global.selectedLanguage = language;
    return language;
  })
 
});
