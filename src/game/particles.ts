import * as THREE from 'three';
import { tC, clamp } from './themes';
import type { RGB } from './types';
import { scene } from './renderer';

// ── Main Particle System ──
export const MAXP = 1200;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(1200 * 3);
const pCol = new Float32Array(1200 * 3);
const pSz = new Float32Array(1200);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
pGeo.setAttribute('size', new THREE.BufferAttribute(pSz, 1));

const pMat = new THREE.PointsMaterial({
  size: 0.18, vertexColors: true, transparent: true, opacity: 0.8,
  blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
});
scene.add(new THREE.Points(pGeo, pMat));

export class Pt {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  c: RGB; life: number; ml: number; sz: number;
  constructor(x: number, y: number, z: number, vx: number, vy: number, vz: number, c: RGB, life: number, sz: number) {
    this.x = x; this.y = y; this.z = z;
    this.vx = vx; this.vy = vy; this.vz = vz;
    this.c = c; this.life = life; this.ml = life; this.sz = sz;
  }
}

export const parts: Pt[] = [];

export function syncParticles(): void {
  for (let i = 0; i < MAXP; i++) {
    if (i < parts.length) {
      const p = parts[i];
      const a = clamp(p.life / p.ml, 0, 1);
      const c = tC(p.c);
      pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.y; pPos[i * 3 + 2] = p.z;
      pCol[i * 3] = c.r * a; pCol[i * 3 + 1] = c.g * a; pCol[i * 3 + 2] = c.b * a;
      pSz[i] = p.sz * a;
    } else {
      pPos[i * 3 + 1] = -100; pSz[i] = 0;
    }
  }
  pGeo.attributes.position.needsUpdate = true;
  pGeo.attributes.color.needsUpdate = true;
  pGeo.attributes.size.needsUpdate = true;
}

// ── Shockwaves ──
export interface ShockData {
  m: THREE.Mesh;
  life: number;
  spd: number;
}

export const shocks: ShockData[] = [];

export function mkShock(c: RGB, spd: number, mx: number, mz: number): void {
  const g = new THREE.RingGeometry(0.1, 0.3, 64);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    color: tC(c), transparent: true, opacity: 0.6,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  m.position.set(mx, 0.15, mz);
  scene.add(m);
  shocks.push({ m, life: 1, spd });
}
