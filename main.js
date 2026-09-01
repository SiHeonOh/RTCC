// main.js — the Electron "main process" (Node.js backend)
require('dotenv').config();
const { app, BrowserWindow, ipcMain } = require('electron');
const { initMain } = require('electron-audio-loopback');
const path = require('path');
const fs = require('fs');
const { WaveFile } = require('wavefile');

// MUST be called before app is ready. This patches getDisplayMedia
// so it can return Windows system-audio loopback.
initMain();

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 300,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // Security best practice: keep Node out of the web page.
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.openDevTools(); // so you can see console logs
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Write raw Int16 PCM bytes to a 16 kHz mono WAV file (Phase 1 test).
ipcMain.handle('save-wav', (_e, name, arrayBuffer) => {
  const pcm = new Int16Array(arrayBuffer);
  const wav = new WaveFile();
  wav.fromScratch(1, 16000, '16', pcm); // 1 channel, 16 kHz, 16-bit
  fs.writeFileSync(path.join(__dirname, name), wav.toBuffer());
  return true;
});
