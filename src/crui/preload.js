const { contextBridge, ipcRenderer } = require('electron');
// const { render } = require('viz.js/full.render.js');

contextBridge.exposeInMainWorld('electron', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readDirectory: (path) => ipcRenderer.invoke('read-directory', path),
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  runAnalysis: (folderPath) => ipcRenderer.invoke('run-analysis', folderPath),
  getAnalysisInfo: (folderPath) => ipcRenderer.invoke('get-analysis-info', folderPath)
  // renderGraphviz: async (dotContent) => {
  //   return render(dotContent);
  // }
});

