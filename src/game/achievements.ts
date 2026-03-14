import type { AchievementDef, AchievementState } from './types';
import { T, rgba, lerp } from './themes';
import { sndAchievement } from './audio';
import { mob } from './input';

const SECTION_NAMES = ['MX'];

export const achState: AchievementState = {
  unlocked: new Set(),
  visited: new Set([0]),
  maxHold: 0,
  maxVel: 0,
  themesUsed: new Set([0]),
  elapsed: 0,
  totalDist: 0,
  clicksPerSec: [0],
  mxBermHits: 0,
  mxRacesCompleted: 0,
  mxLaps: 0,
  mxMaxAir: 0,
  mxBestTime: 0,
  mxCleanLaps: 0,
  mxTracksCompleted: 0,
};

export const ACH_DEFS: AchievementDef[] = [
  { id: 'mx1', icon: '⚑', name: 'Rookie Rider', desc: 'Complete your first race', diff: 'easy', check: () => achState.mxRacesCompleted >= 1 },
  { id: 'mxd', icon: '☁', name: 'Dust Cloud', desc: 'Hit your first jump', diff: 'easy', check: () => achState.mxMaxAir > 0 },
  { id: 'mxa', icon: '↟', name: 'Hang Time', desc: 'Stay airborne 2+ seconds', diff: 'medium', check: () => achState.mxMaxAir >= 2 },
  { id: 'mx3', icon: '⟐', name: 'Track Master', desc: 'Complete all 3 tracks', diff: 'medium', check: () => achState.mxTracksCompleted >= 3 },
  { id: 'mxb', icon: '⤻', name: 'Berm Blaster', desc: 'Hit 10 berms at speed', diff: 'medium', check: () => achState.mxBermHits >= 10 },
  { id: 'p3', icon: '◷', name: 'Endurance', desc: 'Stay 3 minutes', diff: 'medium', check: () => achState.elapsed >= 180 },
  { id: 'mxf', icon: '⏱', name: 'Speed Demon', desc: 'Finish a race under 40s', diff: 'hard', check: () => achState.mxBestTime > 0 && achState.mxBestTime < 40 },
  { id: 'mxc', icon: '⊘', name: 'Clean Run', desc: 'Finish without leaving track', diff: 'hard', check: () => achState.mxCleanLaps >= 1 },
  { id: 'mxh', icon: '↑', name: 'Big Air', desc: 'Stay airborne 4+ seconds', diff: 'hard', check: () => achState.mxMaxAir >= 4 },
  { id: 'p8', icon: '⧫', name: 'Sentinel', desc: 'Stay 8 minutes', diff: 'hard', check: () => achState.elapsed >= 480 },
  { id: 'mx10', icon: '⟡', name: 'MX Legend', desc: 'Complete 10 races', diff: 'epic', check: () => achState.mxRacesCompleted >= 10 },
  { id: 'mxp', icon: '★', name: 'Podium Sweep', desc: 'Best time under 35s', diff: 'epic', check: () => achState.mxBestTime > 0 && achState.mxBestTime < 35 },
];

const DIFF_ORDER: Record<string, number> = { easy: 0, medium: 1, hard: 2, epic: 3 };

export function getDiffColor(diff: string): [number, number, number] {
  const p = T().primary;
  const g: [number, number, number] = [160, 160, 160];
  const f: Record<string, number> = { easy: 0.2, medium: 0.5, hard: 0.8, epic: 1.0 };
  const factor = f[diff] || 1;
  return [lerp(g[0], p[0], factor), lerp(g[1], p[1], factor), lerp(g[2], p[2], factor)];
}

const achTray = document.getElementById('achTray')!;
let activePopup: HTMLElement | null = null;

export function checkAch(): void {
  for (const a of ACH_DEFS) {
    if (achState.unlocked.has(a.id)) continue;
    if (a.check()) {
      achState.unlocked.add(a.id);
      a.sec = SECTION_NAMES[0];
      showToast(a);
      addBadge(a);
    }
  }
}

function _toastOffset(): number {
  return document.querySelectorAll('.ach-toast').length * 46;
}

function showToast(a: AchievementDef): void {
  sndAchievement();
  const e = document.createElement('div');
  e.className = 'ach-toast';
  const dc = getDiffColor(a.diff);
  const t = T();
  e.style.borderColor = rgba(dc, 0.4);
  e.style.color = rgba(dc, 1);
  e.style.background = rgba(t.bg, 0.85);
  e.style.top = (130 + _toastOffset()) + 'px';
  e.innerHTML = `<span class="toast-icon">${a.icon}</span><span class="toast-name">${a.name}</span><span class="toast-sep" style="background:${rgba(dc, 0.4)}"></span><span class="toast-desc">${a.desc}</span>`;
  document.getElementById('hero')!.appendChild(e);
  setTimeout(() => e.remove(), 3200);
}

export function showWRToast(trackName: string, lapTime: number, isGlobal: boolean, fmtMXTime: (s: number) => string): void {
  const t = T();
  const e = document.createElement('div');
  e.className = 'ach-toast';
  const col: [number, number, number] = isGlobal ? [255, 215, 0] : [0, 229, 255];
  e.style.borderColor = rgba(col, 0.6);
  e.style.color = rgba(col, 1);
  e.style.background = rgba(t.bg, 0.9);
  e.style.top = (130 + _toastOffset()) + 'px';
  e.innerHTML = `<span class="toast-icon">${isGlobal ? '♛' : '⟡'}</span><span class="toast-name">${isGlobal ? 'NEW WORLD RECORD' : 'NEW PERSONAL BEST'}</span><span class="toast-sep" style="background:${rgba(col, 0.4)}"></span><span class="toast-desc">${trackName} — ${fmtMXTime(lapTime)}</span>`;
  document.getElementById('hero')!.appendChild(e);
  setTimeout(() => e.remove(), 4000);
  if (isGlobal) sndAchievement();
}

function addBadge(a: AchievementDef): void {
  const e = document.createElement('div');
  e.className = 'ach-badge ach-' + a.diff;
  e.dataset.diffOrder = String(DIFF_ORDER[a.diff]);
  e.dataset.diff = a.diff;
  const dc = getDiffColor(a.diff);
  e.style.borderColor = rgba(dc, 0.7);
  e.style.color = rgba(dc, 0.9);
  e.style.background = rgba(dc, 0.12);
  e.innerHTML = `<span class="ach-icon">${a.icon}</span>`;

  e.addEventListener('mouseenter', () => {
    const tt = document.getElementById('achTooltip')!;
    const dc2 = getDiffColor(a.diff);
    const iconEl = tt.querySelector('#attIcon') as HTMLElement | null;
    if (iconEl && !mob) {
      iconEl.textContent = a.icon; iconEl.style.display = 'block'; iconEl.style.color = rgba(dc2, 1);
    }
    tt.querySelector('#attName')!.textContent = a.name;
    tt.querySelector('#attDesc')!.textContent = a.desc;
    const srcEl = tt.querySelector('#attSource') as HTMLElement | null;
    if (srcEl) srcEl.textContent = 'mx';
    tt.style.color = rgba(dc2, 1);
    (tt.querySelector('#attLine') as HTMLElement).style.background = rgba(dc2, 0.4);
    const r = achTray.getBoundingClientRect();
    tt.style.top = (r.bottom + 14) + 'px';
    tt.style.opacity = '1';
  });

  e.addEventListener('mouseleave', () => {
    const tt = document.getElementById('achTooltip')!;
    tt.style.opacity = '0';
    const iconEl = tt.querySelector('#attIcon') as HTMLElement | null;
    if (iconEl) iconEl.style.display = 'none';
  });

  if (mob) {
    e.addEventListener('touchstart', (ev) => { ev.stopPropagation(); }, { passive: true });
  }

  const ex = [...achTray.children] as HTMLElement[];
  const ib = ex.find(x => +(x.dataset.diffOrder || 0) > DIFF_ORDER[a.diff]);
  if (ib) achTray.insertBefore(e, ib); else achTray.appendChild(e);
}

export function closePop(): void {
  if (activePopup) { activePopup.remove(); activePopup = null; }
}

export function recolorBadges(): void {
  document.querySelectorAll('.ach-badge').forEach((b) => {
    const el = b as HTMLElement;
    const d = el.dataset.diff;
    if (d) {
      const dc = getDiffColor(d);
      el.style.borderColor = rgba(dc, 0.7);
      el.style.color = rgba(dc, 0.9);
      el.style.background = rgba(dc, 0.12);
    }
  });
}
