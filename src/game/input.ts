import type { InputState } from './types';

export const I: InputState = {
  x: innerWidth / 2, y: innerHeight / 2,
  tx: innerWidth / 2, ty: innerHeight / 2,
  rx: 0.5, ry: 0.5,
  down: false, holdTime: 0, clicks: 0,
  vel: 0, px: 0, py: 0,
  mx: 0, mz: 0,
  crx: innerWidth / 2, cry: innerHeight / 2,
  space: false,
};

// Arrow key state for keyboard steering
export let arrowLeft = false;
export let arrowRight = false;
export let arrowUp = false;
export let arrowDown = false;

// ── Touch racing controls (mobile): left drag-steer, right GAS/BRAKE ──
// leanY: -1 = full forward lean, +1 = full back lean (thumb pull)
export const TC = { steer: 0, leanY: 0, throttle: false, brake: false, active: false };

function setupTouchRacingControls(): void {
  const steerZone = document.getElementById('tcSteer');
  const nub = document.getElementById('tcJoy');
  const gas = document.getElementById('tcThrottle');
  const brake = document.getElementById('tcBrake');
  if (!steerZone || !nub || !gas || !brake) return;

  // Floating joystick: rests bottom-left as visible UI, jumps to the thumb
  // on touch. X steers; Y is body lean (pull = back, push = forward).
  let steerId: number | null = null;
  let baseX = 0, baseY = 0;
  const JOY_R = 46;         // px of knob travel for full deflection
  const restJoy = () => {
    nub.style.left = '110px';
    nub.style.bottom = '92px';
    nub.style.top = 'auto';
    nub.style.setProperty('--jx', '0px');
    nub.style.setProperty('--jy', '0px');
  };
  const knob = nub.querySelector('.tc-knob') as HTMLElement | null;
  void knob;

  steerZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (steerId !== null) return;
    const t = e.changedTouches[0];
    steerId = t.identifier;
    baseX = t.clientX;
    baseY = t.clientY;
    TC.active = true;
    nub.style.left = baseX + 'px';
    nub.style.top = baseY + 'px';
    nub.style.bottom = 'auto';
  }, { passive: false });
  steerZone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== steerId) continue;
      let dx = t.clientX - baseX, dy = t.clientY - baseY;
      const len = Math.hypot(dx, dy);
      if (len > JOY_R) { dx *= JOY_R / len; dy *= JOY_R / len; }
      TC.steer = Math.max(-1, Math.min(1, dx / JOY_R));
      TC.leanY = Math.max(-1, Math.min(1, dy / JOY_R));
      nub.style.setProperty('--jx', dx + 'px');
      nub.style.setProperty('--jy', dy + 'px');
    }
  }, { passive: false });
  const steerEnd = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== steerId) continue;
      steerId = null;
      TC.steer = 0;
      TC.leanY = 0;
      TC.active = false;
      restJoy();
    }
  };
  steerZone.addEventListener('touchend', steerEnd);
  steerZone.addEventListener('touchcancel', steerEnd);
  restJoy();

  const bindBtn = (el: HTMLElement, key: 'throttle' | 'brake') => {
    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      TC[key] = true;
      el.classList.add('active');
    }, { passive: false });
    const end = (e: TouchEvent) => {
      e.preventDefault();
      TC[key] = false;
      el.classList.remove('active');
    };
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('touchcancel', end, { passive: false });
  };
  bindBtn(gas, 'throttle');
  bindBtn(brake, 'brake');
}

export const mob = matchMedia('(pointer:coarse)').matches;

const cd = document.getElementById('cdot') as HTMLElement;
const cr = document.getElementById('cring') as HTMLElement;

export function getCursorDot(): HTMLElement { return cd; }
export function getCursorRing(): HTMLElement { return cr; }

if (mob) {
  cd.style.display = 'none';
  cr.style.display = 'none';
  document.body.style.cursor = 'auto';
}

export function isUI(el: Element | null): boolean {
  return !!el && !!(
    el.closest('.nav-section') ||
    el.closest('.globe-btn') || el.closest('.stats-panel') ||
    el.closest('.ach-badge') || el.closest('.ach-popup') ||
    el.closest('.sound-btn') || el.closest('.contact-btn') ||
    el.closest('.contact-overlay') || el.closest('.welcome-screen') ||
    el.closest('.profile-btn') || el.closest('.profile-panel') ||
    el.closest('.leaderboard-btn') || el.closest('.leaderboard-panel') ||
    el.closest('.shop-btn') || el.closest('.shop-panel') ||
    el.closest('.main-menu') || el.closest('.track-select') ||
    el.closest('.post-race') || el.closest('.fullpage-screen')
  );
}

export function setupInputListeners(
  onTheme: (idx: number) => void,
  onNav: (idx: number) => void,
  onClick: () => void,
  onRelease: () => void,
): void {
  document.addEventListener('mousemove', (e) => {
    I.tx = e.clientX; I.ty = e.clientY;
    I.rx = e.clientX / innerWidth; I.ry = e.clientY / innerHeight;
    if (!mob) { cd.style.left = e.clientX + 'px'; cd.style.top = e.clientY + 'px'; }
  });

  document.addEventListener('mousedown', (e) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (isUI(el)) {
      const ns = el!.closest('.nav-section') as HTMLElement | null;
      if (ns) onNav(+ns.dataset.idx!);
      return;
    }
    I.down = true;
    if (!mob) { cd.classList.add('active'); cr.classList.add('active'); }
    onClick();
    I.clicks++;
  });

  document.addEventListener('mouseup', () => {
    if (I.down && I.holdTime > 0.2) onRelease();
    I.down = false; I.holdTime = 0;
    if (!mob) { cd.classList.remove('active'); cr.classList.remove('active'); }
  });

  document.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (t) {
      I.tx = t.clientX; I.ty = t.clientY;
      I.rx = t.clientX / innerWidth; I.ry = t.clientY / innerHeight;
    }
  }, { passive: true });

  document.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    if (!t) return;
    const el = document.elementFromPoint(t.clientX, t.clientY);
    if (isUI(el)) {
      const ns = el!.closest('.nav-section') as HTMLElement | null;
      if (ns) onNav(+ns.dataset.idx!);
      return;
    }
    I.tx = t.clientX; I.ty = t.clientY;
    I.x = I.tx; I.y = I.ty;
    I.down = true;
    onClick();
    I.clicks++;
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (I.down && I.holdTime > 0.2) onRelease();
    I.down = false; I.holdTime = 0;
  });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); I.space = true; }
    if (e.code === 'ArrowLeft') { e.preventDefault(); arrowLeft = true; }
    if (e.code === 'ArrowRight') { e.preventDefault(); arrowRight = true; }
    if (e.code === 'ArrowUp') { e.preventDefault(); arrowUp = true; if (!I.down) { I.down = true; onClick(); } }
    if (e.code === 'ArrowDown') { e.preventDefault(); arrowDown = true; }
  });
  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') { I.space = false; }
    if (e.code === 'ArrowLeft') { arrowLeft = false; }
    if (e.code === 'ArrowRight') { arrowRight = false; }
    if (e.code === 'ArrowUp') { arrowUp = false; if (!arrowDown) { I.down = false; I.holdTime = 0; onRelease(); } }
    if (e.code === 'ArrowDown') { arrowDown = false; }
  });

  if (mob) setupTouchRacingControls();

}

import * as THREE from 'three';

const raycaster = new THREE.Raycaster();
const mPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const mW = new THREE.Vector3();

export function updateMouse3D(camera: THREE.PerspectiveCamera): void {
  raycaster.setFromCamera(
    new THREE.Vector2((I.x / innerWidth) * 2 - 1, -(I.y / innerHeight) * 2 + 1),
    camera,
  );
  raycaster.ray.intersectPlane(mPlane, mW);
  I.mx = mW.x || 0;
  I.mz = mW.z || 0;
}
