import { lerp } from './themes';

let audioCtx: AudioContext | null = null;
let soundOn = false;
let sfxGain: GainNode | null = null;

// Engine sound state
let engineNode: { o1: OscillatorNode; o2: OscillatorNode; bp: BiquadFilterNode; ws: WaveShaperNode } | null = null;
let engineGain: GainNode | null = null;
let engineRunning = false;

export function isSoundOn(): boolean { return soundOn; }
export function setSoundOn(v: boolean): void { soundOn = v; }
export function getAudioCtx(): AudioContext | null { return audioCtx; }

export function initAudio(): void {
  if (audioCtx) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return;
  }
  audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  sfxGain = audioCtx.createGain();
  sfxGain.gain.value = 1.0;
  sfxGain.connect(audioCtx.destination);
}

export function playTone(f: number, dur: number, vol = 0.06, type: OscillatorType = 'square'): void {
  if (!audioCtx) return;
  const dest = sfxGain || audioCtx.destination;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  o.connect(g); g.connect(dest); o.start(); o.stop(audioCtx.currentTime + dur);
}

export function playNoise(dur: number, vol: number, filterFreq: number, filterQ?: number): void {
  if (!audioCtx) return;
  const buf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * dur), audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.3));
  const s = audioCtx.createBufferSource(); s.buffer = buf;
  const g = audioCtx.createGain(); g.gain.value = vol;
  const flt = audioCtx.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = filterFreq; flt.Q.value = filterQ || 1;
  const dest = sfxGain || audioCtx.destination;
  s.connect(flt); flt.connect(g); g.connect(dest); s.start();
}

export function startEngine(): void {
  if (engineRunning || !audioCtx) return;
  engineRunning = true;
  const o1 = audioCtx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 60;
  const o2 = audioCtx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 62;
  const ws = audioCtx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 3); }
  ws.curve = curve; ws.oversample = '2x';
  const bp = audioCtx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 180; bp.Q.value = 2;
  engineGain = audioCtx.createGain(); engineGain.gain.value = 0;
  const dest = sfxGain || audioCtx.destination;
  o1.connect(ws); o2.connect(ws); ws.connect(bp); bp.connect(engineGain); engineGain.connect(dest);
  o1.start(); o2.start();
  engineNode = { o1, o2, bp, ws };
}

export function updateEngine(speed: number, maxSpeed: number, accel: boolean): void {
  if (!engineNode || !engineGain) return;
  const ratio = speed / maxSpeed;
  const freq = 55 + ratio * 125;
  engineNode.o1.frequency.value = freq;
  engineNode.o2.frequency.value = freq * 1.03;
  engineNode.bp.frequency.value = 120 + ratio * 200;
  const targetVol = speed < 0.5 ? 0 : (accel ? 0.06 + ratio * 0.06 : 0.02 + ratio * 0.03);
  engineGain.gain.value = lerp(engineGain.gain.value, targetVol, 0.1);
}

export function stopEngine(): void {
  if (!engineRunning || !engineNode) return;
  engineRunning = false;
  try { engineNode.o1.stop(); engineNode.o2.stop(); } catch (_) { /* ignore */ }
  engineNode = null; engineGain = null;
}

// ── SFX Functions ──

export function sndClick(): void {
  if (!soundOn || !audioCtx) return;
  playTone(90, 0.15, 0.08, 'sawtooth');
  playTone(120, 0.1, 0.06, 'sawtooth');
}

export function sndShockwave(): void {
  if (!soundOn || !audioCtx) return;
  playTone(80, 0.2, 0.1, 'sawtooth');
  playNoise(0.15, 0.06, 200, 1);
}

export function sndSectionChange(): void {
  if (!soundOn || !audioCtx) return;
  playTone(440, 0.08, 0.1, 'triangle');
  setTimeout(() => playTone(554, 0.08, 0.1, 'triangle'), 70);
  setTimeout(() => playTone(659, 0.1, 0.1, 'triangle'), 140);
}

export function sndAchievement(): void {
  if (!soundOn || !audioCtx) return;
  playTone(523, 0.1, 0.1, 'triangle');
  setTimeout(() => playTone(659, 0.1, 0.1, 'triangle'), 100);
  setTimeout(() => playTone(784, 0.12, 0.12, 'triangle'), 200);
  setTimeout(() => playTone(1047, 0.2, 0.08, 'triangle'), 300);
}

export function sndThemeSwitch(): void {
  if (!soundOn || !audioCtx) return;
  playTone(350, 0.05, 0.06, 'triangle');
  setTimeout(() => playTone(500, 0.06, 0.05, 'triangle'), 50);
}

export function sndCheckpoint(): void {
  if (!soundOn || !audioCtx) return;
  playTone(1200, 0.06, 0.08, 'sine');
  playTone(1600, 0.04, 0.05, 'sine');
}

export function sndLanding(): void {
  if (!soundOn || !audioCtx) return;
  playTone(50, 0.12, 0.12, 'sine');
  playNoise(0.1, 0.08, 300, 2);
}

export function sndJump(): void {
  if (!soundOn || !audioCtx) return;
  playTone(200, 0.08, 0.05, 'sawtooth');
  playTone(400, 0.06, 0.03, 'sawtooth');
}
