import * as THREE from 'three';
import type { Theme, RGB } from './types';

// Single palette matched to the TheMotoHub logo: TMH red, white, silver, black.
export const THEMES: Theme[] = [
  {
    name: 'MOTOHUB',
    primary: [237, 47, 54],     // TMH red (logo gradient mid)
    secondary: [248, 250, 252], // white (HUD values)
    accent: [184, 192, 199],    // logo silver
    bg: [14, 13, 13],           // near-black (logo outline)
    grid: [120, 90, 60],        // unused (legacy)
  },
];

let curTheme = 0;

export function T(): Theme {
  return THEMES[curTheme];
}

export function setThemeIndex(idx: number): void {
  curTheme = idx;
}

export function getThemeIndex(): number {
  return curTheme;
}

// ── Color Utilities ──

export function rgba(c: RGB, a = 1): string {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
}

export function tC(c: RGB): THREE.Color {
  return new THREE.Color(c[0] / 255, c[1] / 255, c[2] / 255);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpColor(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function dst(x: number, y: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x, y2 - y);
}
