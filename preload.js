// preload.js — the only bridge between the web page and Node.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  enableLoopbackAudio: () => ipcRenderer.invoke('enable-loopback-audio'),
  disableLoopbackAudio: () => ipcRenderer.invoke('disable-loopback-audio'),
  saveWav: (name, buf) => ipcRenderer.invoke('save-wav', name, buf),
  // used in later phases:
  sendAudioChunk: (buf) => ipcRenderer.send('audio-chunk', buf),
  onOptions: (cb) => ipcRenderer.on('options', (_e, data) => cb(data)),
  onGenerating: (cb) => ipcRenderer.on('generating', () => cb()),
  onSelected: (cb) => ipcRenderer.on('selected', (_e, i) => cb(i)),
});
