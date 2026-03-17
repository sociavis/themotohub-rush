import * as THREE from 'three';
import { THEMES, T, setThemeIndex, rgba, tC } from '../game/themes';
import { sndThemeSwitch } from '../game/audio';
import { achState, recolorBadges } from '../game/achievements';
import { mob, getCursorDot, getCursorRing } from '../game/input';
import { R, scene, gridMat, ptL, ptL2 } from '../game/renderer';
import { frame, seat } from '../game/bike';
import { mxTrackMeshes, mxCPMeshes, dustLine, tireTrailLine } from '../game/track-builder';

export function applyTheme(idx: number): void {
  setThemeIndex(idx);
  achState.themesUsed.add(idx);
  sndThemeSwitch();
  const t = THEMES[idx];

  document.documentElement.style.setProperty('--orange', rgba(t.primary, 1));

  let s = document.getElementById('dynamic-corners');
  if (s) s.remove();
  s = document.createElement('style');
  s.id = 'dynamic-corners';
  s.textContent = `.hud-corner::before,.hud-corner::after{background:${rgba(t.primary, 1)} !important}`;
  document.head.appendChild(s);

  let p = document.getElementById('dynamic-panels');
  if (p) p.remove();
  p = document.createElement('style');
  p.id = 'dynamic-panels';
  p.textContent = `.hud-panel{color:${rgba(t.secondary, 0.75)} !important}.hud-panel .label{color:${rgba(t.primary, 0.8)} !important}.hud-panel .value{color:${rgba(t.secondary, 1)} !important}.hud-panel .warn{color:${rgba(t.accent, 1)} !important}.hint-line{color:${rgba(t.primary, 0.85)} !important;border-color:${rgba(t.primary, 0.12)} !important}`;
  document.head.appendChild(p);

  document.querySelectorAll('.nav-track-bg').forEach(e => (e as HTMLElement).style.background = rgba(t.primary, 1));
  document.querySelectorAll('.nav-track-fill').forEach(e => (e as HTMLElement).style.background = rgba(t.primary, 1));
  document.querySelectorAll('.nav-chevron path').forEach(e => e.setAttribute('fill', rgba(t.primary, 1)));
  document.querySelectorAll('.nav-label').forEach(e => (e as HTMLElement).style.color = rgba(t.primary, 1));

  const cd = getCursorDot();
  const cr = getCursorRing();
  if (!mob) {
    cd.style.background = rgba(t.primary, 1);
    cd.style.boxShadow = `0 0 12px ${rgba(t.primary, 1)}`;
    cr.style.border = `1.5px solid ${rgba(t.primary, 1)}`;
  }

  document.body.style.background = rgba(t.bg, 1);
  document.getElementById('wmLogo')!.style.color = rgba(t.primary, 1);

  ['globeBtn', 'soundBtn', 'contactBtn', 'profileBtn', 'leaderboardBtn', 'shopBtn'].forEach(id => {
    const e = document.getElementById(id);
    if (!e) return;
    e.style.borderColor = rgba(t.primary, 0.2);
    const svg = e.querySelector('svg');
    if (svg) svg.style.color = rgba(t.primary, 1);
  });
  const ml = document.querySelector('.mute-line') as HTMLElement | null;
  if (ml) ml.style.background = rgba(t.primary, 1);

  R.setClearColor(new THREE.Color(t.bg[0] / 255, t.bg[1] / 255, t.bg[2] / 255));
  scene.fog!.color.set(new THREE.Color(t.bg[0] / 255, t.bg[1] / 255, t.bg[2] / 255));
  gridMat.color = tC(t.grid);
  ptL.color = tC(t.primary);
  ptL2.color = tC(t.secondary);

  (frame.material as THREE.MeshStandardMaterial).color = tC(t.primary);
  (frame.material as THREE.MeshStandardMaterial).emissive = tC(t.primary);
  (seat.material as THREE.MeshStandardMaterial).color = tC(t.primary);
  (seat.material as THREE.MeshStandardMaterial).emissive = tC(t.primary);

  (dustLine.material as THREE.LineBasicMaterial).color = tC(t.primary);
  (tireTrailLine.material as THREE.LineBasicMaterial).color = tC(t.primary);

  mxTrackMeshes.forEach(m => {
    if ((m as any).material?.emissive) {
      (m as any).material.color = tC(t.primary);
      (m as any).material.emissive = tC(t.primary);
    } else if ((m as any).material?.color) {
      (m as any).material.color = tC(t.primary);
    }
  });
  mxCPMeshes.forEach(m => { if ((m as any).material) (m as any).material.color = tC(t.secondary); });

  recolorBadges();
}
