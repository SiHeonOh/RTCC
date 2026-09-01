// renderer/renderer.js  (PHASE 2: continuous streaming to Deepgram via main)
const statusEl = document.getElementById('status');

// Convert Web Audio Float32 [-1..1] to 16-bit PCM Int16.
function floatTo16BitPCM(float32) {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    let s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

async function streamSystemAudio() {
  statusEl.textContent = 'Enabling loopback...';
  await window.electronAPI.enableLoopbackAudio();
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
  stream.getVideoTracks().forEach((t) => { t.stop(); stream.removeTrack(t); });
  await window.electronAPI.disableLoopbackAudio();

  const ctx = new AudioContext({ sampleRate: 16000 });
  const source = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  source.connect(proc); proc.connect(ctx.destination);
  proc.onaudioprocess = (e) => {
    const pcm = floatTo16BitPCM(e.inputBuffer.getChannelData(0));
    window.electronAPI.sendAudioChunk(pcm.buffer);
  };
  statusEl.textContent = 'Streaming system audio... (transcripts appear in the terminal)';
}

streamSystemAudio().catch((err) => {
  statusEl.textContent = 'Error: ' + err.message;
  console.error(err);
});
