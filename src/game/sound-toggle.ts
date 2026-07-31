import { initAudio, isSoundOn, setSoundOn, playTone, startEngine, stopEngine, getAudioCtx } from './audio';
import { storeGet, storeSet } from './safe-storage';

let _lastBtnTap = 0;
function btnGuard(): boolean { const now = Date.now(); if (now - _lastBtnTap < 350) return false; _lastBtnTap = now; return true; }

const soundBtn = document.getElementById('soundBtn')!;

export function toggleSound(): void {
  initAudio();
  const ctx = getAudioCtx();
  if (ctx && ctx.state === 'suspended') ctx.resume();
  const newState = !isSoundOn();
  setSoundOn(newState);
  storeSet('mx_sound', newState ? '1' : '0');
  soundBtn.classList.toggle('on', newState);
  soundBtn.classList.toggle('off', !newState);
  if (newState) { playTone(350, 0.05, 0.06, 'triangle'); startEngine(); }
  else { stopEngine(); }
}

export function initSoundToggle(): void {
  // Sound is ON unless the rider muted it previously
  const saved = storeGet('mx_sound');
  setSoundOn(saved === null ? true : saved === '1');
  soundBtn.classList.toggle('on', isSoundOn());
  soundBtn.classList.toggle('off', !isSoundOn());

  // Browsers won't let audio start without a gesture, so arm it on the first
  // touch/click/key. CAPTURE phase: menu buttons stopPropagation, so a
  // bubble-phase listener never sees the taps that actually get us here.
  const arm = (): void => {
    if (isSoundOn()) {
      initAudio();
      const ctx = getAudioCtx();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    }
    document.removeEventListener('touchstart', arm, true);
    document.removeEventListener('click', arm, true);
    document.removeEventListener('keydown', arm, true);
  };
  document.addEventListener('touchstart', arm, { passive: true, capture: true });
  document.addEventListener('click', arm, true);
  document.addEventListener('keydown', arm, true);

  soundBtn.addEventListener('click', (e) => { e.stopPropagation(); if (btnGuard()) toggleSound(); });
}
