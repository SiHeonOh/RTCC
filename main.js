// main.js — the Electron "main process" (Node.js backend)
require('dotenv').config();
const { app, BrowserWindow, ipcMain } = require('electron');
const { initMain } = require('electron-audio-loopback');
const path = require('path');
const fs = require('fs');
const { WaveFile } = require('wavefile');
const WebSocket = require('ws');
let dgSocket = null;

function connectDeepgram(onTranscript) {
  const params = new URLSearchParams({
    model: 'nova-3',
    language: 'en',
    encoding: 'linear16',   // raw 16-bit PCM
    sample_rate: '16000',   // MUST match the renderer's AudioContext rate
    channels: '1',
    interim_results: 'true',// growing partial transcripts
    punctuate: 'true',
    endpointing: '300',     // ms of silence before finalizing
    utterance_end_ms: '1000',
  });
  const url = `wss://api.deepgram.com/v1/listen?${params.toString()}`;
  const socket = new WebSocket(url, {
    headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` },
  });

  socket.on('open', () => console.log('[DG] connected'));
  socket.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === 'Results') {
      const alt = msg.channel && msg.channel.alternatives[0];
      const text = alt ? alt.transcript : '';
      if (text) onTranscript(text, msg.is_final === true);
    }
  });
  socket.on('close', () => console.log('[DG] closed'));
  socket.on('error', (e) => console.error('[DG] error', e.message));

  // Keep-alive: Deepgram closes idle sockets after ~10s of silence.
  const ka = setInterval(() => {
    if (socket.readyState === WebSocket.OPEN)
      socket.send(JSON.stringify({ type: 'KeepAlive' }));
  }, 8000);
  socket.on('close', () => clearInterval(ka));
  return socket;
}

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

app.whenReady().then(() => {
  createWindow();
  dgSocket = connectDeepgram((text, isFinal) => {
    console.log(isFinal ? `[FINAL] ${text}` : `[partial] ${text}`);
  });
});

// Receive PCM chunks from the renderer and forward to Deepgram.
ipcMain.on('audio-chunk', (_e, arrayBuffer) => {
  if (dgSocket && dgSocket.readyState === WebSocket.OPEN) {
    dgSocket.send(Buffer.from(arrayBuffer));
  }
});

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
