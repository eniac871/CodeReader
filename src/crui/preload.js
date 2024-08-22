const { contextBridge, ipcRenderer } = require('electron');
const Viz = require('viz.js');
const { Module, render } = require('viz.js/full.render.js');
const {path} = require('path')

contextBridge.exposeInMainWorld('electron', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readDirectory: (path) => ipcRenderer.invoke('read-directory', path),
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  runAnalysis: (folderPath) => ipcRenderer.invoke('run-analysis', folderPath),
  getAnalysisInfo: (folderPath) => ipcRenderer.invoke('get-analysis-info', folderPath),
  getFileAnalysisInfo: (filePath) => ipcRenderer.invoke('get-file-analysis-info', filePath),
  getFunctionCallStackAnalysis: (functionName) => ipcRenderer.invoke('function-call-stack-analysis', functionName),
  getFunctionInternalCallStackAnalysis: (filePath, functionName) => ipcRenderer.invoke('function-internal-call-graph-analysis', filePath, functionName),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  showItemInFolder: (filePath) => ipcRenderer.invoke('show-item-in-folder', filePath),
  sendLanguageChoice: (language) => ipcRenderer.invoke('send-language-choice', language),
  vizRender: async (content) => {
    const viz = new Viz({ Module, render }); 
    return await viz.renderString(content);
  },
  path:{
    dirname:(filePath) => path.dirname(filePath)
  }
  // renderGraphviz: async (dotContent) => {
  //   return render(dotContent);
  // }
});