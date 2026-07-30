import { THEMES, setThemeIndex, rgba } from '../game/themes';
import { achState, recolorBadges } from '../game/achievements';
import { mob, getCursorDot, getCursorRing } from '../game/input';

// Applies the UI palette (DOM/CSS only — the 3D scene styles itself
// per-track via the atmosphere system in track-builder/renderer).
export function applyTheme(idx: number): void {
  setThemeIndex(idx);
  achState.themesUsed.add(idx);
  const t = THEMES[idx] || THEMES[0];

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
  p.textContent = `.hud-panel{color:${rgba(t.secondary, 0.75)} !important}.hud-panel .label{color:${rgba(t.primary, 0.9)} !important}.hud-panel .value{color:${rgba(t.secondary, 1)} !important}.hud-panel .warn{color:${rgba(t.accent, 1)} !important}.hint-line{color:${rgba(t.secondary, 0.85)} !important;border-color:${rgba(t.primary, 0.15)} !important}`;
  document.head.appendChild(p);

  const cd = getCursorDot();
  const cr = getCursorRing();
  if (!mob) {
    cd.style.background = rgba(t.primary, 1);
    cd.style.boxShadow = `0 0 12px ${rgba(t.primary, 1)}`;
    cr.style.border = `1.5px solid ${rgba(t.primary, 1)}`;
  }

  document.body.style.background = rgba(t.bg, 1);
  const logo = document.getElementById('wmLogo');
  if (logo) logo.style.color = rgba(t.primary, 1);

  ['globeBtn', 'soundBtn', 'contactBtn', 'profileBtn', 'leaderboardBtn', 'shopBtn'].forEach(id => {
    const e = document.getElementById(id);
    if (!e) return;
    e.style.borderColor = rgba(t.primary, 0.25);
    const svg = e.querySelector('svg');
    if (svg) svg.style.color = rgba(t.primary, 1);
  });
  const ml = document.querySelector('.mute-line') as HTMLElement | null;
  if (ml) ml.style.background = rgba(t.primary, 1);

  recolorBadges();
}
