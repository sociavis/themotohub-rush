import type { InputState } from './types';

export const I: InputState = {
  x: innerWidth / 2, y: innerHeight / 2,
  tx: innerWidth / 2, ty: innerHeight / 2,
  rx: 0.5, ry: 0.5,
  down: false, holdTime: 0, clicks: 0,
  vel: 0, px: 0, py: 0,
  mx: 0, mz: 0,
  crx: innerWidth / 2, cry: innerHeight / 2,
};

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
    el.closest('.theme-item') || el.closest('.nav-section') ||
    el.closest('.globe-btn') || el.closest('.stats-panel') ||
    el.closest('.ach-badge') || el.closest('.ach-popup') ||
    el.closest('.sound-btn') || el.closest('.contact-btn') ||
    el.closest('.contact-overlay')
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
      const tb = el!.closest('.theme-item') as HTMLElement | null;
      if (tb) onTheme(+tb.dataset.theme!);
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
      const tb = el!.closest('.theme-item') as HTMLElement | null;
      if (tb) onTheme(+tb.dataset.theme!);
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
