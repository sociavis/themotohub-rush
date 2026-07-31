import * as THREE from 'three';

// ── Procedural canvas textures for the realistic MX look ──
// Everything is generated at runtime so the game stays asset-free.

function cvs(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!];
}

function finalize(c: HTMLCanvasElement, repeat = true): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; }
  tex.anisotropy = 4;
  return tex;
}

function shade(hex: string, amt: number): string {
  // amt -1..1 darken/lighten
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, r + amt * 255));
  g = Math.max(0, Math.min(255, g + amt * 255));
  b = Math.max(0, Math.min(255, b + amt * 255));
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

// Speckled natural ground (sand, snow, grass, clay …)
export function makeGroundTexture(base: string, dark: string, speckle = 2600): THREE.CanvasTexture {
  const [c, x] = cvs(512, 512);
  x.fillStyle = base;
  x.fillRect(0, 0, 512, 512);
  // Large soft patches
  for (let i = 0; i < 26; i++) {
    const g = x.createRadialGradient(
      Math.random() * 512, Math.random() * 512, 4,
      Math.random() * 512, Math.random() * 512, 40 + Math.random() * 90);
    g.addColorStop(0, dark);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.globalAlpha = 0.10 + Math.random() * 0.12;
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 512);
  }
  x.globalAlpha = 1;
  // Speckles
  for (let i = 0; i < speckle; i++) {
    const a = 0.05 + Math.random() * 0.2;
    x.fillStyle = Math.random() > 0.5
      ? shade(base, -(0.08 + Math.random() * 0.2))
      : shade(base, 0.06 + Math.random() * 0.14);
    x.globalAlpha = a;
    const s = 1 + Math.random() * 2.5;
    x.fillRect(Math.random() * 512, Math.random() * 512, s, s);
  }
  x.globalAlpha = 1;
  return finalize(c);
}

// Dirt racing surface with tire ruts running along V
export function makeTrackTexture(base = '#71543a', rut = '#4c3826'): THREE.CanvasTexture {
  const S = 512;
  const [c, x] = cvs(S, S);
  x.fillStyle = base;
  x.fillRect(0, 0, S, S);

  // ── Multi-octave tonal noise: soft blotches → fine grain ──
  // Low-frequency octaves are drawn on tiny canvases and upscaled with
  // smoothing so the dirt gets natural large-scale moisture variation.
  for (const [cell, alpha] of [[8, 0.22], [16, 0.16], [32, 0.12]] as [number, number][]) {
    const [oc, ox] = cvs(cell, cell);
    const img = ox.createImageData(cell, cell);
    const bn = parseInt(base.slice(1), 16);
    const br = (bn >> 16) & 255, bg = (bn >> 8) & 255, bb = bn & 255;
    for (let i = 0; i < cell * cell; i++) {
      const v = (Math.random() - 0.5) * 90;
      img.data[i * 4] = Math.max(0, Math.min(255, br + v));
      img.data[i * 4 + 1] = Math.max(0, Math.min(255, bg + v));
      img.data[i * 4 + 2] = Math.max(0, Math.min(255, bb + v));
      img.data[i * 4 + 3] = 255;
    }
    ox.putImageData(img, 0, 0);
    x.globalAlpha = alpha;
    x.imageSmoothingEnabled = true;
    x.drawImage(oc, 0, 0, cell, cell, 0, 0, S, S);
  }
  x.globalAlpha = 1;

  // ── Fine grain speckle ──
  for (let i = 0; i < 4200; i++) {
    x.globalAlpha = 0.04 + Math.random() * 0.14;
    x.fillStyle = Math.random() > 0.5 ? shade(base, -(0.06 + Math.random() * 0.2)) : shade(base, 0.05 + Math.random() * 0.12);
    const sz = 1 + Math.random() * 2.5;
    x.fillRect(Math.random() * S, Math.random() * S, sz, sz);
  }
  x.globalAlpha = 1;

  // ── Longitudinal wear grooves (thin wavy streaks down the track) ──
  for (let i = 0; i < 90; i++) {
    const u0 = Math.random() * S;
    const drift = (Math.random() - 0.5) * 30;
    const light = Math.random() > 0.6;
    x.strokeStyle = light ? shade(base, 0.08 + Math.random() * 0.08) : shade(base, -(0.08 + Math.random() * 0.12));
    x.globalAlpha = 0.10 + Math.random() * 0.14;
    x.lineWidth = 1 + Math.random() * 2;
    x.beginPath();
    x.moveTo(u0, -4);
    x.bezierCurveTo(u0 + drift * 0.3, S * 0.33, u0 + drift * 0.7, S * 0.66, u0 + drift, S + 4);
    x.stroke();
  }
  x.globalAlpha = 1;

  // ── Twin wheel-line ruts with fake relief (shadow left, highlight right) ──
  for (const u of [0.32, 0.68]) {
    const cx = u * S, w = 0.115 * S;
    // packed dark centre
    const g = x.createLinearGradient(cx - w, 0, cx + w, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.45, rut);
    g.addColorStop(0.55, rut);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.globalAlpha = 0.6;
    x.fillStyle = g;
    x.fillRect(cx - w, 0, w * 2, S);
    // relief: dark inner edge + sunlit outer lip
    x.globalAlpha = 0.35;
    x.fillStyle = 'rgba(20,12,6,1)';
    x.fillRect(cx - w * 0.55, 0, 2.5, S);
    x.globalAlpha = 0.3;
    x.fillStyle = shade(base, 0.22);
    x.fillRect(cx + w * 0.55, 0, 2, S);
    x.globalAlpha = 1;
    // knobby chatter marks (brake bumps) inside the rut
    for (let v = 0; v < S; v += 6 + Math.random() * 6) {
      const jx = cx - 8 + Math.random() * 16;
      x.globalAlpha = 0.22 + Math.random() * 0.2;
      x.fillStyle = 'rgba(24,15,8,1)';
      x.fillRect(jx, v, 9 + Math.random() * 5, 2.5);
      // lit lower edge of each bump
      x.globalAlpha = 0.14;
      x.fillStyle = shade(base, 0.25);
      x.fillRect(jx, v + 2.5, 9, 1.2);
    }
  }
  x.globalAlpha = 1;

  // ── Scattered pebbles with light/shadow ──
  for (let i = 0; i < 110; i++) {
    const px = Math.random() * S, py = Math.random() * S;
    const r = 1 + Math.random() * 2.4;
    x.globalAlpha = 0.5 + Math.random() * 0.3;
    x.fillStyle = shade(base, -(0.18 + Math.random() * 0.1));
    x.beginPath(); x.ellipse(px + 0.7, py + 0.7, r, r * 0.8, 0, 0, 7); x.fill();
    x.fillStyle = shade(base, 0.14 + Math.random() * 0.14);
    x.beginPath(); x.ellipse(px, py, r * 0.8, r * 0.6, 0, 0, 7); x.fill();
  }
  x.globalAlpha = 1;

  // ── Dry lighter edges + centre crown ──
  const eg = x.createLinearGradient(0, 0, S, 0);
  eg.addColorStop(0, shade(base, 0.14));
  eg.addColorStop(0.1, 'rgba(0,0,0,0)');
  eg.addColorStop(0.46, shade(base, 0.07));
  eg.addColorStop(0.54, shade(base, 0.07));
  eg.addColorStop(0.9, 'rgba(0,0,0,0)');
  eg.addColorStop(1, shade(base, 0.14));
  x.globalAlpha = 0.45;
  x.fillStyle = eg;
  x.fillRect(0, 0, S, S);
  x.globalAlpha = 1;

  const tex = finalize(c);
  tex.anisotropy = 16;   // track is viewed at grazing angles — this is the big win
  return tex;
}

export function makeCheckerTexture(n = 6): THREE.CanvasTexture {
  const [c, x] = cvs(128, 128);
  const s = 128 / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      x.fillStyle = (i + j) % 2 === 0 ? '#f2f2f2' : '#111111';
      x.fillRect(i * s, j * s, s, s);
    }
  }
  return finalize(c);
}

export function makeBannerTexture(text: string, bg = '#e33a1e', fg = '#ffffff'): THREE.CanvasTexture {
  const [c, x] = cvs(1024, 128);
  x.fillStyle = bg;
  x.fillRect(0, 0, 1024, 128);
  // top/bottom rails
  x.fillStyle = 'rgba(0,0,0,0.35)';
  x.fillRect(0, 0, 1024, 10);
  x.fillRect(0, 118, 1024, 10);
  x.fillStyle = fg;
  x.font = '900 76px Arial, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.letterSpacing = '14px' as any;
  x.fillText(text, 512, 70);
  const tex = finalize(c, false);
  return tex;
}

// Sponsor-style track-side banner strip (repeating)
export function makeSideBannerTexture(text: string, bg: string, fg: string): THREE.CanvasTexture {
  const [c, x] = cvs(512, 64);
  x.fillStyle = bg;
  x.fillRect(0, 0, 512, 64);
  x.fillStyle = fg;
  x.font = '900 38px Arial, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, 256, 34);
  return finalize(c);
}

// Stadium crowd — thousands of tiny colored dots
export function makeCrowdTexture(): THREE.CanvasTexture {
  const [c, x] = cvs(256, 128);
  x.fillStyle = '#16161c';
  x.fillRect(0, 0, 256, 128);
  const cols = ['#c9c2b6', '#8a8f99', '#b3543e', '#4e6d8c', '#d9d0c0', '#6d5a4a', '#3e5a3e', '#e0b13e'];
  for (let i = 0; i < 2400; i++) {
    x.fillStyle = cols[(Math.random() * cols.length) | 0];
    x.globalAlpha = 0.5 + Math.random() * 0.5;
    x.fillRect(Math.random() * 256, Math.random() * 128, 1.6, 2.2);
  }
  x.globalAlpha = 1;
  return finalize(c);
}

// Race number plate
export function makePlateTexture(num: string, bg = '#f5f2ea', fg = '#111111'): THREE.CanvasTexture {
  const [c, x] = cvs(128, 128);
  x.fillStyle = bg;
  x.fillRect(0, 0, 128, 128);
  x.fillStyle = fg;
  x.font = '900 84px Arial, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(num, 64, 70);
  return finalize(c, false);
}

// Soft round sprite (sun / clouds / dust)
export function makeGlowSprite(inner: string, outer: string): THREE.CanvasTexture {
  const [c, x] = cvs(128, 128);
  const g = x.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return finalize(c, false);
}

export function makeCloudSprite(): THREE.CanvasTexture {
  const [c, x] = cvs(256, 128);
  for (let i = 0; i < 14; i++) {
    const cx = 40 + Math.random() * 176;
    const cy = 50 + Math.random() * 40;
    const r = 18 + Math.random() * 30;
    const g = x.createRadialGradient(cx, cy, 2, cx, cy, r);
    g.addColorStop(0, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 128);
  }
  return finalize(c, false);
}
