import { initAudio, isSoundOn, setSoundOn, playTone, startEngine, stopEngine, getAudioCtx } from './audio';

let _lastBtnTap = 0;
function btnGuard(): boolean { const now = Date.now(); if (now - _lastBtnTap < 350) return false; _lastBtnTap = now; return true; }

const soundBtn = document.getElementById('soundBtn')!;

export function toggleSound(): void {
  initAudio();
  const ctx = getAudioCtx();
  if (ctx && ctx.state === 'suspended') ctx.resume();
  const newState = !isSoundOn();
  setSoundOn(newState);
  soundBtn.classList.toggle('on', newState);
  soundBtn.classList.toggle('off', !newState);
  if (newState) { playTone(350, 0.05, 0.06, 'triangle'); startEngine(); }
  else { stopEngine(); }
}

export function initSoundToggle(): void {
  // Mobile: resume audio context on any touch
  document.addEventListener('touchstart', function resumeAudio() {
    const ctx = getAudioCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }, { passive: true });

  soundBtn.addEventListener('click', (e) => { e.stopPropagation(); if (btnGuard()) toggleSound(); });
}
