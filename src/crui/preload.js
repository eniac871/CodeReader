const { contextBridge, ipcRenderer } = require('electron');


contextBridge.exposeInMainWorld('electron', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readDirectory: (path) => ipcRenderer.invoke('read-directory', path),
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  runAnalysis: (folderPath) => ipcRenderer.invoke('run-analysis', folderPath),
  getAnalysisInfo: (folderPath) => ipcRenderer.invoke('get-analysis-info', folderPath),
  getFileAnalysisInfo: (filePath) => ipcRenderer.invoke('get-file-analysis-info', filePath),
  getFunctionCallStackAnalysis: (functionName) => ipcRenderer.invoke('function-call-stack-analysis', functionName),
  getFunctionInternalCallStackAnalysis: (filePath, functionName) => ipcRenderer.invoke('function-internal-call-graph-analysis', filePath, functionName),
  // renderGraphviz: async (dotContent) => {
  //   return render(dotContent);
  // }
});

