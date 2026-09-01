// renderer/renderer.js  (PHASE 1 TEST)
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

async function captureStreamPCM(stream, seconds) {
  // Force 16 kHz mono — the sample rate Deepgram will want later.
  const ctx = new AudioContext({ sampleRate: 16000 });
  const source = ctx.createMediaStreamSource(stream);
  const chunks = [];
  // ScriptProcessorNode is deprecated but by far the simplest for a beginner.
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  source.connect(proc);
  proc.connect(ctx.destination);
  proc.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0); // Float32
    chunks.push(floatTo16BitPCM(input));
  };
  await new Promise((r) => setTimeout(r, seconds * 1000));
  proc.disconnect(); source.disconnect(); await ctx.close();

  // Concatenate all Int16 chunks.
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const pcm = new Int16Array(total);
  let off = 0;
  for (const c of chunks) { pcm.set(c, off); off += c.length; }
  return pcm;
}

document.getElementById('record').onclick = async () => {
  statusEl.textContent = 'Enabling loopback...';
  // 1) SYSTEM AUDIO (the other person / YouTube):
  await window.electronAPI.enableLoopbackAudio();
  const sysStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
  sysStream.getVideoTracks().forEach((t) => { t.stop(); sysStream.removeTrack(t); });
  await window.electronAPI.disableLoopbackAudio();

  // 2) MICROPHONE (you):
  const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  statusEl.textContent = 'Recording 30s of each...';
  const [sysPCM, micPCM] = await Promise.all([
    captureStreamPCM(sysStream, 30),
    captureStreamPCM(micStream, 30),
  ]);

  // Hand raw bytes to main.js to write WAV files.
  await window.electronAPI.saveWav('system.wav', sysPCM.buffer);
  await window.electronAPI.saveWav('mic.wav', micPCM.buffer);
  statusEl.textContent = 'Done. Check system.wav and mic.wav in the project folder.';
};
