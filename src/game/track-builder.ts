import * as THREE from 'three';
import { T, tC } from './themes';
import { MX_TRACKS, TRACK_W, MX_CHECKPOINTS } from './tracks';
import { scene, R, ambL, dirL } from './renderer';
import { mxBike, bikeGroup } from './bike';
import type { TrackDef } from './types';

// ── Track State ──
export let mxTrackIdx = 0;
export let mxSpline: THREE.CatmullRomCurve3 | null = null;
export let mxSplineLen = 0;
export let mxTrackMeshes: (THREE.Object3D & { material?: any; geometry?: any; isMesh?: boolean })[] = [];
export let mxCPMeshes: { userData: { cpIdx: number; cpT: number } }[] = [];
export let mxFinishMesh: THREE.Mesh | null = null;

export function setTrackIdx(idx: number): void { mxTrackIdx = idx; }
export function nextTrack(): void { mxTrackIdx = (mxTrackIdx + 1) % MX_TRACKS.length; }

// ── S4 Group ──
export const s4 = new THREE.Group();
scene.add(s4);

// ── Dust Trail ──
const dustGeo = new THREE.BufferGeometry();
const dustPos = new Float32Array(90 * 3);
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
export const dustLine = new THREE.Line(
  dustGeo,
  new THREE.LineBasicMaterial({ color: tC(T().primary), transparent: true, opacity: 0.3 }),
);
dustLine.visible = false;
s4.add(dustLine);
export const dustTrail: { x: number; y: number; z: number }[] = [];

// ── Tire Track Trail ──
export const TIRE_TRAIL_MAX = 3000;
const tireTrailGeo = new THREE.BufferGeometry();
const tireTrailPos = new Float32Array(TIRE_TRAIL_MAX * 3);
tireTrailGeo.setAttribute('position', new THREE.BufferAttribute(tireTrailPos, 3));
export const tireTrailLine = new THREE.Line(
  tireTrailGeo,
  new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08 }),
);
tireTrailLine.visible = false;
s4.add(tireTrailLine);
export const tireTrail: { x: number; y: number; z: number }[] = [];

// ── MX Ambient Particles ──
export const mxAmbientParts: { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; ml: number }[] = [];
export const MX_AMB_MAX = 60;
const mxAmbGeo = new THREE.BufferGeometry();
const mxAmbPos = new Float32Array(60 * 3);
const mxAmbSz = new Float32Array(60);
mxAmbGeo.setAttribute('position', new THREE.BufferAttribute(mxAmbPos, 3));
mxAmbGeo.setAttribute('size', new THREE.BufferAttribute(mxAmbSz, 1));
export const mxAmbMat = new THREE.PointsMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, size: 0.15, sizeAttenuation: true });
export const mxAmbPoints = new THREE.Points(mxAmbGeo, mxAmbMat);
mxAmbPoints.visible = false;
s4.add(mxAmbPoints);

// ── Roost Particles ──
export const mxRoostParts: { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; ml: number }[] = [];
export const MX_ROOST_MAX = 70;
const mxRoostGeo = new THREE.BufferGeometry();
const mxRoostPos = new Float32Array(70 * 3);
const mxRoostSz = new Float32Array(70);
mxRoostGeo.setAttribute('position', new THREE.BufferAttribute(mxRoostPos, 3));
mxRoostGeo.setAttribute('size', new THREE.BufferAttribute(mxRoostSz, 1));
export const mxRoostMat = new THREE.PointsMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, size: 0.2, sizeAttenuation: true });
export const mxRoostPoints = new THREE.Points(mxRoostGeo, mxRoostMat);
mxRoostPoints.visible = false;
s4.add(mxRoostPoints);

// Add bike to s4
s4.add(bikeGroup);

// ── Precomputed Height / Berm LUTs ──
const TRACK_LUT_RES = 1000;
let _heightLUT = new Float32Array(TRACK_LUT_RES + 1);
let _bermLUT = new Float32Array(TRACK_LUT_RES + 1);

function buildTrackLUT(): void {
  const trk = MX_TRACKS[mxTrackIdx];
  for (let i = 0; i <= TRACK_LUT_RES; i++) {
    const tP = i / TRACK_LUT_RES;
    let h = 0, b = 0;
    for (const ob of trk.obs) {
      if (ob.type === 'hill') {
        const spread = ob.len || 0.12;
        if (tP >= ob.at && tP <= ob.at + spread) {
          const p = (tP - ob.at) / spread;
          h = (ob.h || 0) * (1 - Math.cos(p * Math.PI * 2)) / 2;
        }
      } else if (ob.type === 'berm') {
        const w = 0.06;
        if (tP >= ob.at && tP < ob.at + w) {
          const p = (tP - ob.at) / w;
          b = (ob.side || 0) * Math.sin(p * Math.PI) * 0.4;
        }
      }
    }
    _heightLUT[i] = h;
    _bermLUT[i] = b;
  }
}

export function getTrackHeight(tParam: number): number {
  const idx = Math.round(tParam * TRACK_LUT_RES);
  return _heightLUT[Math.min(idx, TRACK_LUT_RES)];
}

export function getBerm(tParam: number): number {
  const idx = Math.round(tParam * TRACK_LUT_RES);
  return _bermLUT[Math.min(idx, TRACK_LUT_RES)];
}

// ── Build Track ──
export function buildTrack(): void {
  // Clean up old meshes
  mxTrackMeshes.forEach(m => { s4.remove(m); if (m.geometry) m.geometry.dispose(); });
  mxCPMeshes = [];
  if (mxFinishMesh) { s4.remove(mxFinishMesh); mxFinishMesh.geometry.dispose(); }
  mxTrackMeshes = [];

  const trk = MX_TRACKS[mxTrackIdx];
  // Center at origin
  let centX = 0, centZ = 0;
  for (const p of trk.pts) { centX += p[0]; centZ += p[1]; }
  centX /= trk.pts.length; centZ /= trk.pts.length;
  const pts3d = trk.pts.map(p => new THREE.Vector3(p[0] - centX, 0, p[1] - centZ));
  mxSpline = new THREE.CatmullRomCurve3(pts3d, true, 'chordal');
  mxSplineLen = mxSpline.getLength();
  buildTrackLUT();

  const RES = 600;
  const leftPts: THREE.Vector3[] = [], rightPts: THREE.Vector3[] = [];
  for (let i = 0; i <= RES; i++) {
    const tP = i / RES;
    const pt = mxSpline.getPointAt(tP);
    const tan = mxSpline.getTangentAt(tP).normalize();
    const norm = new THREE.Vector3(-tan.z, 0, tan.x);
    const h = getTrackHeight(tP);
    leftPts.push(new THREE.Vector3(pt.x + norm.x * TRACK_W, h, pt.z + norm.z * TRACK_W));
    rightPts.push(new THREE.Vector3(pt.x - norm.x * TRACK_W, h, pt.z - norm.z * TRACK_W));
  }

  // Surface mesh
  const sv: number[] = [], si: number[] = [];
  for (let i = 0; i <= RES; i++) {
    sv.push(leftPts[i].x, leftPts[i].y, leftPts[i].z);
    sv.push(rightPts[i].x, rightPts[i].y, rightPts[i].z);
  }
  for (let i = 0; i < RES; i++) {
    const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
    si.push(a, b, c, b, d, c);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sv, 3));
  sg.setIndex(si); sg.computeVertexNormals();
  const surfMesh = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({
    color: tC(trk.envColor), emissive: tC(trk.envColor), emissiveIntensity: 0.15,
    transparent: true, opacity: 0.5, side: THREE.DoubleSide, metalness: 0.2, roughness: 0.8,
  }));
  s4.add(surfMesh); mxTrackMeshes.push(surfMesh);

  // Edge lines
  const ll = new THREE.Line(new THREE.BufferGeometry().setFromPoints(leftPts),
    new THREE.LineBasicMaterial({ color: tC(T().primary), transparent: true, opacity: 0.9 }));
  s4.add(ll); mxTrackMeshes.push(ll);
  const rl = new THREE.Line(new THREE.BufferGeometry().setFromPoints(rightPts),
    new THREE.LineBasicMaterial({ color: tC(T().primary), transparent: true, opacity: 0.9 }));
  s4.add(rl); mxTrackMeshes.push(rl);

  // Berm markers
  for (const ob of trk.obs) {
    if (ob.type !== 'berm') continue;
    const w = 0.06; const bermSegs = 20;
    const bermVerts: number[] = [], bermIdx: number[] = [];
    for (let i = 0; i <= bermSegs; i++) {
      const tP = ob.at + i / bermSegs * w;
      const pt = mxSpline.getPointAt(tP);
      const tan = mxSpline.getTangentAt(tP).normalize();
      const norm = new THREE.Vector3(-tan.z, 0, tan.x);
      const offset = (ob.side || 0) > 0 ? TRACK_W : -TRACK_W;
      const bankH = 1.6 * Math.sin(i / bermSegs * Math.PI);
      const h = getTrackHeight(tP);
      bermVerts.push(pt.x + norm.x * offset, h, pt.z + norm.z * offset);
      bermVerts.push(pt.x + norm.x * offset * 1.2, h + bankH, pt.z + norm.z * offset * 1.2);
    }
    for (let i = 0; i < bermSegs; i++) {
      const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
      bermIdx.push(a, b, c, b, d, c);
    }
    const bermGeo = new THREE.BufferGeometry();
    bermGeo.setAttribute('position', new THREE.Float32BufferAttribute(bermVerts, 3));
    bermGeo.setIndex(bermIdx); bermGeo.computeVertexNormals();
    const bermMesh = new THREE.Mesh(bermGeo, new THREE.MeshStandardMaterial({
      color: tC(T().secondary), emissive: tC(T().secondary), emissiveIntensity: 0.2,
      transparent: true, opacity: 0.45, side: THREE.DoubleSide, roughness: 0.7,
    }));
    s4.add(bermMesh); mxTrackMeshes.push(bermMesh);
    // Berm edge line (top)
    const bermTopPts: THREE.Vector3[] = [];
    for (let i = 0; i <= bermSegs; i++) {
      const tP = ob.at + i / bermSegs * w;
      const pt = mxSpline.getPointAt(tP);
      const tan = mxSpline.getTangentAt(tP).normalize();
      const norm = new THREE.Vector3(-tan.z, 0, tan.x);
      const offset = (ob.side || 0) > 0 ? TRACK_W : -TRACK_W;
      const bankH = 1.6 * Math.sin(i / bermSegs * Math.PI);
      const h = getTrackHeight(tP);
      bermTopPts.push(new THREE.Vector3(pt.x + norm.x * offset * 1.2, h + bankH, pt.z + norm.z * offset * 1.2));
    }
    if (bermTopPts.length > 1) {
      const btl = new THREE.Line(new THREE.BufferGeometry().setFromPoints(bermTopPts),
        new THREE.LineBasicMaterial({ color: tC(T().primary), transparent: true, opacity: 0.8 }));
      s4.add(btl); mxTrackMeshes.push(btl);
    }
  }

  // Finish line
  const fp = mxSpline.getPointAt(0);
  const fTan = mxSpline.getTangentAt(0).normalize();
  const fNorm = new THREE.Vector3(-fTan.z, 0, fTan.x);
  const fh = getTrackHeight(0);
  const crossAngle = Math.atan2(fNorm.x, fNorm.z);
  const finCvs = document.createElement('canvas'); finCvs.width = 64; finCvs.height = 64;
  const fctx = finCvs.getContext('2d')!;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    fctx.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : 'rgba(0,0,0,0)';
    fctx.fillRect(x * 16, y * 16, 16, 16);
  }
  const finTex = new THREE.CanvasTexture(finCvs);
  finTex.wrapS = THREE.RepeatWrapping; finTex.wrapT = THREE.RepeatWrapping; finTex.repeat.set(1, 5);
  const finMat = new THREE.MeshBasicMaterial({
    map: finTex, color: tC(T().primary), transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const finMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, TRACK_W * 2), finMat);
  finMesh.position.set(fp.x, fh + 0.04, fp.z); finMesh.rotation.y = crossAngle;
  s4.add(finMesh); mxTrackMeshes.push(finMesh);
  mxFinishMesh = finMesh;

  // Invisible checkpoints
  for (let i = 0; i < MX_CHECKPOINTS; i++) {
    const cpT = (i + 1) / (MX_CHECKPOINTS + 1);
    mxCPMeshes.push({ userData: { cpIdx: i, cpT } });
  }

  // Track border markers
  const MARKER_COUNT = 24;
  for (let i = 0; i < MARKER_COUNT; i++) {
    const tP = i / MARKER_COUNT;
    const pt = mxSpline.getPointAt(tP);
    const tan = mxSpline.getTangentAt(tP).normalize();
    const norm = new THREE.Vector3(-tan.z, 0, tan.x);
    const h = getTrackHeight(tP);
    const orbIn = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({ color: tC(T().primary), transparent: true, opacity: 0.7 }));
    orbIn.position.set(pt.x - norm.x * TRACK_W, h + 0.15, pt.z - norm.z * TRACK_W);
    s4.add(orbIn); mxTrackMeshes.push(orbIn);
    const orbOut = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({ color: tC(T().secondary), transparent: true, opacity: 0.7 }));
    orbOut.position.set(pt.x + norm.x * TRACK_W, h + 0.15, pt.z + norm.z * TRACK_W);
    s4.add(orbOut); mxTrackMeshes.push(orbOut);
  }

  // Environment
  buildEnvironment(trk);

  // Render order
  mxTrackMeshes.forEach(m => {
    if ((m as any).isMesh && m !== surfMesh && m !== finMesh) {
      (m as any).renderOrder = 2;
      if ((m as any).material) (m as any).material.depthWrite = true;
    }
  });

  // Per-track atmosphere
  setAtmosphere(trk);

  // Cache material colors
  const ec = tC(trk.envColor);
  mxRoostMat.color = ec; mxRoostMat.opacity = 0.5;
  mxAmbMat.color = ec;
  (tireTrailLine.material as THREE.LineBasicMaterial).color = ec;
}

function buildEnvironment(trk: TrackDef): void {
  const envC = trk.envColor;
  if (trk.envType === 'desert') {
    for (let i = 0; i < 14; i++) {
      const ang = Math.random() * Math.PI * 2, dist = 28 + Math.random() * 18;
      const mh = 1 + Math.random() * 2.5, mw = 2 + Math.random() * 5, md = 2 + Math.random() * 4;
      const m = new THREE.Mesh(new THREE.BoxGeometry(mw, mh, md),
        new THREE.MeshStandardMaterial({ color: tC([(185 + Math.random() * 40) | 0, (100 + Math.random() * 30) | 0, (40 + Math.random() * 20) | 0]), emissive: tC(envC), emissiveIntensity: 0.04, transparent: true, opacity: 0.55, roughness: 0.95 }));
      m.position.set(Math.cos(ang) * dist, mh * 0.3, Math.sin(ang) * dist); m.rotation.y = Math.random() * Math.PI;
      s4.add(m); mxTrackMeshes.push(m);
    }
    for (let i = 0; i < 22; i++) {
      const ang = Math.random() * Math.PI * 2, dist = i < 8 ? (6 + Math.random() * 4) : (24 + Math.random() * 22);
      const sz = i < 8 ? (0.1 + Math.random() * 0.25) : (0.2 + Math.random() * 0.65);
      const r = new THREE.Mesh(new THREE.IcosahedronGeometry(sz, 0),
        new THREE.MeshStandardMaterial({ color: tC([175, 115, 55]), emissive: tC(envC), emissiveIntensity: 0.03, transparent: true, opacity: 0.4, roughness: 0.9 }));
      r.position.set(Math.cos(ang) * dist, Math.random() * 0.15, Math.sin(ang) * dist);
      r.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      s4.add(r); mxTrackMeshes.push(r);
    }
    for (let i = 0; i < 10; i++) {
      const ang = Math.random() * Math.PI * 2, dist = 26 + Math.random() * 16;
      const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
      const trunkH = 2 + Math.random();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, trunkH, 7),
        new THREE.MeshStandardMaterial({ color: tC([55, 115, 40]), emissive: tC([30, 70, 20]), emissiveIntensity: 0.1, transparent: true, opacity: 0.45 }));
      trunk.position.set(x, trunkH / 2, z); s4.add(trunk); mxTrackMeshes.push(trunk);
      const armDir = Math.random() > 0.5 ? 1 : -1;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.1, 7),
        new THREE.MeshStandardMaterial({ color: tC([55, 115, 40]), emissive: tC([30, 70, 20]), emissiveIntensity: 0.1, transparent: true, opacity: 0.45 }));
      arm.rotation.z = armDir * 0.75; arm.position.set(x + armDir * 0.7, trunkH * 0.7, z);
      s4.add(arm); mxTrackMeshes.push(arm);
    }
  } else if (trk.envType === 'ice') {
    for (let i = 0; i < 16; i++) {
      const ang = Math.random() * Math.PI * 2, dist = 28 + Math.random() * 18;
      const sh = 2.5 + Math.random() * 5, sr = 0.18 + Math.random() * 0.45;
      const cr = new THREE.Mesh(new THREE.ConeGeometry(sr, sh, 6),
        new THREE.MeshStandardMaterial({ color: tC([205, 238, 255]), emissive: tC(envC), emissiveIntensity: 0.22, transparent: true, opacity: 0.35, metalness: 0.7, roughness: 0.08 }));
      cr.position.set(Math.cos(ang) * dist, sh / 2, Math.sin(ang) * dist); cr.rotation.y = Math.random() * Math.PI;
      s4.add(cr); mxTrackMeshes.push(cr);
    }
    for (let i = 0; i < 12; i++) {
      const ang = Math.random() * Math.PI * 2, dist = 26 + Math.random() * 16;
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(3 + Math.random() * 5, 0.12, 2 + Math.random() * 4),
        new THREE.MeshStandardMaterial({ color: tC([225, 248, 255]), emissive: tC(envC), emissiveIntensity: 0.14, transparent: true, opacity: 0.3, metalness: 0.6, roughness: 0.05 }));
      shelf.position.set(Math.cos(ang) * dist, 0.06 + Math.random() * 0.25, Math.sin(ang) * dist); shelf.rotation.y = Math.random() * Math.PI;
      s4.add(shelf); mxTrackMeshes.push(shelf);
    }
    for (let i = 0; i < 20; i++) {
      const ang = Math.random() * Math.PI * 2, dist = i < 6 ? (5 + Math.random() * 4) : (24 + Math.random() * 22);
      const sz = i < 6 ? (0.12 + Math.random() * 0.2) : (0.25 + Math.random() * 0.55);
      const ic = new THREE.Mesh(new THREE.OctahedronGeometry(sz, 0),
        new THREE.MeshStandardMaterial({ color: tC([185, 228, 255]), emissive: tC(envC), emissiveIntensity: 0.1, transparent: true, opacity: 0.25, metalness: 0.5, roughness: 0.1 }));
      ic.position.set(Math.cos(ang) * dist, 0.15 + Math.random() * 0.3, Math.sin(ang) * dist);
      ic.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      s4.add(ic); mxTrackMeshes.push(ic);
    }
  } else if (trk.envType === 'neon') {
    for (let i = 0; i < 28; i++) {
      const ang = Math.random() * Math.PI * 2, dist = 28 + Math.random() * 18;
      const bh = 2 + Math.random() * 10, bw = 1 + Math.random() * 3, bd = 1 + Math.random() * 3;
      const bld = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd),
        new THREE.MeshBasicMaterial({ color: tC(envC), transparent: true, opacity: 0.07 + Math.random() * 0.09 }));
      bld.position.set(Math.cos(ang) * dist, bh / 2, Math.sin(ang) * dist); bld.rotation.y = Math.random() * Math.PI * 0.5;
      s4.add(bld); mxTrackMeshes.push(bld);
      const wnd = new THREE.Mesh(new THREE.BoxGeometry(bw * 1.02, 0.07, bd * 1.02),
        new THREE.MeshBasicMaterial({ color: tC(envC), transparent: true, opacity: 0.45 }));
      wnd.position.set(Math.cos(ang) * dist, bh * 0.6, Math.sin(ang) * dist); wnd.rotation.y = bld.rotation.y;
      s4.add(wnd); mxTrackMeshes.push(wnd);
    }
    const gSz = 42, gStep = 4;
    for (let g = -gSz / 2; g <= gSz / 2; g += gStep) {
      const gl = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(g, 0.01, -gSz / 2), new THREE.Vector3(g, 0.01, gSz / 2)]),
        new THREE.LineBasicMaterial({ color: tC(envC), transparent: true, opacity: 0.07 }));
      const gl2 = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-gSz / 2, 0.01, g), new THREE.Vector3(gSz / 2, 0.01, g)]),
        new THREE.LineBasicMaterial({ color: tC(envC), transparent: true, opacity: 0.07 }));
      s4.add(gl); s4.add(gl2); mxTrackMeshes.push(gl); mxTrackMeshes.push(gl2);
    }
    for (let i = 0; i < 12; i++) {
      const ang = Math.random() * Math.PI * 2, dist = 26 + Math.random() * 18;
      const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 5 + Math.random() * 5, 6),
        new THREE.MeshBasicMaterial({ color: tC(envC), transparent: true, opacity: 0.45 }));
      pl.position.set(Math.cos(ang) * dist, 2.5, Math.sin(ang) * dist);
      s4.add(pl); mxTrackMeshes.push(pl);
    }
    // Light towers
    for (let i = 0; i < 8; i++) {
      const tP = i / 8;
      const pt = mxSpline!.getPointAt(tP);
      const tan = mxSpline!.getTangentAt(tP).normalize();
      const norm = new THREE.Vector3(-tan.z, 0, tan.x);
      const side = i % 2 === 0 ? 1 : -1;
      const towerX = pt.x + norm.x * TRACK_W * 2.5 * side;
      const towerZ = pt.z + norm.z * TRACK_W * 2.5 * side;
      const towerH = 6 + Math.random() * 3;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, towerH, 6),
        new THREE.MeshBasicMaterial({ color: tC(envC), transparent: true, opacity: 0.3 }));
      pole.position.set(towerX, towerH / 2, towerZ); s4.add(pole); mxTrackMeshes.push(pole);
      const lightHead = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
      lightHead.position.set(towerX, towerH, towerZ); s4.add(lightHead); mxTrackMeshes.push(lightHead);
      const coneH = 4;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2, coneH, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: tC(envC), transparent: true, opacity: 0.06, side: THREE.DoubleSide }));
      cone.position.set(towerX, towerH - coneH / 2 - 0.5, towerZ); s4.add(cone); mxTrackMeshes.push(cone);
      const tLight = new THREE.PointLight(new THREE.Color(envC[0] / 255, envC[1] / 255, envC[2] / 255), 2, 15);
      tLight.position.set(towerX, towerH - 0.5, towerZ); s4.add(tLight); mxTrackMeshes.push(tLight as any);
    }
  } else if (trk.envType === 'volcanic') {
    // Jagged rock formations
    for (let i = 0; i < 18; i++) {
      const ang = Math.random() * Math.PI * 2, dist = 26 + Math.random() * 20;
      const rh = 1.5 + Math.random() * 4, rr = 0.3 + Math.random() * 0.8;
      const rock = new THREE.Mesh(new THREE.ConeGeometry(rr, rh, 5 + Math.floor(Math.random() * 3)),
        new THREE.MeshStandardMaterial({ color: tC([60, 25, 15]), emissive: tC([255, 40, 10]), emissiveIntensity: 0.08, transparent: true, opacity: 0.6, roughness: 0.95 }));
      rock.position.set(Math.cos(ang) * dist, rh / 2, Math.sin(ang) * dist); rock.rotation.y = Math.random() * Math.PI;
      s4.add(rock); mxTrackMeshes.push(rock);
    }
    // Lava pools (glowing flat circles)
    for (let i = 0; i < 8; i++) {
      const ang = Math.random() * Math.PI * 2, dist = 30 + Math.random() * 16;
      const poolR = 1 + Math.random() * 2.5;
      const pool = new THREE.Mesh(new THREE.CircleGeometry(poolR, 16),
        new THREE.MeshBasicMaterial({ color: tC([255, 80, 10]), transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
      pool.rotation.x = -Math.PI / 2; pool.position.set(Math.cos(ang) * dist, 0.03, Math.sin(ang) * dist);
      s4.add(pool); mxTrackMeshes.push(pool);
      const glow = new THREE.PointLight(new THREE.Color(1, 0.2, 0.02), 1.2, 8);
      glow.position.set(Math.cos(ang) * dist, 0.5, Math.sin(ang) * dist); s4.add(glow); mxTrackMeshes.push(glow as any);
    }
    // Scattered boulders
    for (let i = 0; i < 20; i++) {
      const ang = Math.random() * Math.PI * 2, dist = i < 6 ? (5 + Math.random() * 4) : (22 + Math.random() * 24);
      const sz = 0.15 + Math.random() * 0.5;
      const boulder = new THREE.Mesh(new THREE.IcosahedronGeometry(sz, 0),
        new THREE.MeshStandardMaterial({ color: tC([80, 35, 20]), emissive: tC(envC), emissiveIntensity: 0.05, transparent: true, opacity: 0.5, roughness: 0.9 }));
      boulder.position.set(Math.cos(ang) * dist, sz * 0.4, Math.sin(ang) * dist);
      boulder.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      s4.add(boulder); mxTrackMeshes.push(boulder);
    }
    // Smoke columns
    for (let i = 0; i < 6; i++) {
      const ang = Math.random() * Math.PI * 2, dist = 32 + Math.random() * 14;
      const colH = 4 + Math.random() * 6;
      const smoke = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.15, colH, 8),
        new THREE.MeshBasicMaterial({ color: tC([80, 40, 20]), transparent: true, opacity: 0.08 }));
      smoke.position.set(Math.cos(ang) * dist, colH / 2, Math.sin(ang) * dist);
      s4.add(smoke); mxTrackMeshes.push(smoke);
    }
  } else if (trk.envType === 'jungle') {
    // Dense trees
    for (let i = 0; i < 24; i++) {
      const ang = Math.random() * Math.PI * 2, dist = 22 + Math.random() * 22;
      const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
      const trunkH = 3 + Math.random() * 4;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, trunkH, 7),
        new THREE.MeshStandardMaterial({ color: tC([65, 40, 20]), emissive: tC([30, 60, 20]), emissiveIntensity: 0.05, transparent: true, opacity: 0.55, roughness: 0.9 }));
      trunk.position.set(x, trunkH / 2, z); s4.add(trunk); mxTrackMeshes.push(trunk);
      // Canopy
      const canopyR = 1.5 + Math.random() * 2;
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(canopyR, 8, 6),
        new THREE.MeshStandardMaterial({ color: tC([20 + Math.floor(Math.random() * 30), 140 + Math.floor(Math.random() * 60), 30 + Math.floor(Math.random() * 30)]), emissive: tC(envC), emissiveIntensity: 0.06, transparent: true, opacity: 0.4, roughness: 0.8 }));
      canopy.position.set(x, trunkH + canopyR * 0.3, z); s4.add(canopy); mxTrackMeshes.push(canopy);
    }
    // Ferns and ground cover
    for (let i = 0; i < 18; i++) {
      const ang = Math.random() * Math.PI * 2, dist = i < 6 ? (5 + Math.random() * 4) : (20 + Math.random() * 20);
      const sz = 0.3 + Math.random() * 0.6;
      const fern = new THREE.Mesh(new THREE.ConeGeometry(sz, sz * 1.5, 4),
        new THREE.MeshStandardMaterial({ color: tC([30, 160, 50]), emissive: tC(envC), emissiveIntensity: 0.04, transparent: true, opacity: 0.35, roughness: 0.85 }));
      fern.position.set(Math.cos(ang) * dist, sz * 0.5, Math.sin(ang) * dist);
      s4.add(fern); mxTrackMeshes.push(fern);
    }
    // Vines (thin cylinders connecting trees)
    for (let i = 0; i < 8; i++) {
      const ang = Math.random() * Math.PI * 2, dist = 24 + Math.random() * 16;
      const vineH = 3 + Math.random() * 4;
      const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, vineH, 4),
        new THREE.MeshBasicMaterial({ color: tC([40, 120, 30]), transparent: true, opacity: 0.3 }));
      vine.position.set(Math.cos(ang) * dist, vineH / 2 + 2, Math.sin(ang) * dist);
      vine.rotation.z = (Math.random() - 0.5) * 0.5;
      s4.add(vine); mxTrackMeshes.push(vine);
    }
  } else if (trk.envType === 'stadium') {
    // Stadium stands (tiered boxes)
    const standCount = 16;
    for (let i = 0; i < standCount; i++) {
      const tP = i / standCount;
      const pt = mxSpline!.getPointAt(tP);
      const tan = mxSpline!.getTangentAt(tP).normalize();
      const norm = new THREE.Vector3(-tan.z, 0, tan.x);
      for (let tier = 0; tier < 3; tier++) {
        const side = i % 2 === 0 ? 1 : -1;
        const standDist = TRACK_W * (3 + tier * 1.8);
        const standH = 1.5 + tier * 1.5;
        const stand = new THREE.Mesh(new THREE.BoxGeometry(3.2, standH, 1.2),
          new THREE.MeshStandardMaterial({ color: tC([40, 25, 60]), emissive: tC(envC), emissiveIntensity: 0.06, transparent: true, opacity: 0.4, roughness: 0.7 }));
        stand.position.set(pt.x + norm.x * standDist * side, standH / 2, pt.z + norm.z * standDist * side);
        stand.rotation.y = Math.atan2(tan.x, tan.z);
        s4.add(stand); mxTrackMeshes.push(stand);
      }
    }
    // Floodlights
    for (let i = 0; i < 8; i++) {
      const tP = (i + 0.5) / 8;
      const pt = mxSpline!.getPointAt(tP);
      const tan = mxSpline!.getTangentAt(tP).normalize();
      const norm = new THREE.Vector3(-tan.z, 0, tan.x);
      const side = i % 2 === 0 ? 1 : -1;
      const towerX = pt.x + norm.x * TRACK_W * 4 * side;
      const towerZ = pt.z + norm.z * TRACK_W * 4 * side;
      const towerH = 10 + Math.random() * 3;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, towerH, 6),
        new THREE.MeshStandardMaterial({ color: tC([80, 60, 100]), emissive: tC(envC), emissiveIntensity: 0.1, transparent: true, opacity: 0.5 }));
      pole.position.set(towerX, towerH / 2, towerZ); s4.add(pole); mxTrackMeshes.push(pole);
      const lightHead = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.4),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
      lightHead.position.set(towerX, towerH, towerZ); lightHead.rotation.y = Math.atan2(tan.x, tan.z);
      s4.add(lightHead); mxTrackMeshes.push(lightHead);
      const sLight = new THREE.PointLight(new THREE.Color(envC[0] / 255, envC[1] / 255, envC[2] / 255), 3, 20);
      sLight.position.set(towerX, towerH - 0.5, towerZ); s4.add(sLight); mxTrackMeshes.push(sLight as any);
    }
    // Ground grid
    const gSz = 50, gStep = 5;
    for (let g = -gSz / 2; g <= gSz / 2; g += gStep) {
      const gl = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(g, 0.01, -gSz / 2), new THREE.Vector3(g, 0.01, gSz / 2)]),
        new THREE.LineBasicMaterial({ color: tC(envC), transparent: true, opacity: 0.05 }));
      const gl2 = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-gSz / 2, 0.01, g), new THREE.Vector3(gSz / 2, 0.01, g)]),
        new THREE.LineBasicMaterial({ color: tC(envC), transparent: true, opacity: 0.05 }));
      s4.add(gl); s4.add(gl2); mxTrackMeshes.push(gl); mxTrackMeshes.push(gl2);
    }
  }
}

function setAtmosphere(trk: TrackDef): void {
  if (trk.envType === 'desert') {
    R.setClearColor(new THREE.Color(0.55, 0.42, 0.25));
    scene.fog!.color.set(new THREE.Color(0.55, 0.42, 0.25));
    (scene.fog as THREE.FogExp2).density = 0.004;
    ambL.color.set(new THREE.Color(0.6, 0.45, 0.3)); ambL.intensity = 0.8;
    dirL.color.set(new THREE.Color(1, 0.9, 0.7)); dirL.intensity = 0.9; dirL.position.set(8, 20, 5);
  } else if (trk.envType === 'ice') {
    R.setClearColor(new THREE.Color(0.04, 0.08, 0.18));
    scene.fog!.color.set(new THREE.Color(0.04, 0.08, 0.18));
    (scene.fog as THREE.FogExp2).density = 0.005;
    ambL.color.set(new THREE.Color(0.15, 0.25, 0.45)); ambL.intensity = 0.6;
    dirL.color.set(new THREE.Color(0.6, 0.8, 1.0)); dirL.intensity = 0.5; dirL.position.set(5, 15, 5);
  } else if (trk.envType === 'neon') {
    R.setClearColor(new THREE.Color(0.02, 0.02, 0.05));
    scene.fog!.color.set(new THREE.Color(0.02, 0.02, 0.05));
    (scene.fog as THREE.FogExp2).density = 0.005;
    ambL.color.set(new THREE.Color(0.07, 0.05, 0.1)); ambL.intensity = 0.3;
    dirL.color.set(new THREE.Color(1, 1, 1)); dirL.intensity = 0.15; dirL.position.set(5, 15, 5);
  } else if (trk.envType === 'volcanic') {
    R.setClearColor(new THREE.Color(0.15, 0.04, 0.02));
    scene.fog!.color.set(new THREE.Color(0.15, 0.04, 0.02));
    (scene.fog as THREE.FogExp2).density = 0.006;
    ambL.color.set(new THREE.Color(0.5, 0.15, 0.05)); ambL.intensity = 0.6;
    dirL.color.set(new THREE.Color(1, 0.4, 0.15)); dirL.intensity = 0.7; dirL.position.set(6, 18, 4);
  } else if (trk.envType === 'jungle') {
    R.setClearColor(new THREE.Color(0.04, 0.12, 0.04));
    scene.fog!.color.set(new THREE.Color(0.04, 0.12, 0.04));
    (scene.fog as THREE.FogExp2).density = 0.006;
    ambL.color.set(new THREE.Color(0.15, 0.35, 0.1)); ambL.intensity = 0.7;
    dirL.color.set(new THREE.Color(0.8, 1, 0.6)); dirL.intensity = 0.6; dirL.position.set(4, 20, 6);
  } else if (trk.envType === 'stadium') {
    R.setClearColor(new THREE.Color(0.03, 0.02, 0.06));
    scene.fog!.color.set(new THREE.Color(0.03, 0.02, 0.06));
    (scene.fog as THREE.FogExp2).density = 0.004;
    ambL.color.set(new THREE.Color(0.1, 0.08, 0.15)); ambL.intensity = 0.4;
    dirL.color.set(new THREE.Color(0.9, 0.8, 1)); dirL.intensity = 0.5; dirL.position.set(5, 18, 5);
  }
}

export function setVis(): void {
  s4.visible = true;
  bikeGroup.visible = true;
  dustLine.visible = true;
  tireTrailLine.visible = true;
  mxAmbPoints.visible = true;
  mxRoostPoints.visible = true;
  mxTrackMeshes.forEach(m => (m as any).visible = true);
}

export function updateDustTrail(bikePos: THREE.Vector3, curTan: THREE.Vector3, trackH: number, speed: number, bikeGrounded: boolean): void {
  if (speed > 2 && bikeGrounded) {
    dustTrail.push({ x: bikePos.x - curTan.x * 0.5, y: trackH + 0.05, z: bikePos.z - curTan.z * 0.5 });
    if (dustTrail.length > 30) dustTrail.shift();
  } else if (dustTrail.length > 0) {
    dustTrail.shift();
  }
  const dp = (dustLine.geometry as THREE.BufferGeometry).attributes.position.array as Float32Array;
  for (let i = 0; i < 30; i++) {
    if (i < dustTrail.length) { dp[i * 3] = dustTrail[i].x; dp[i * 3 + 1] = dustTrail[i].y; dp[i * 3 + 2] = dustTrail[i].z; }
    else { dp[i * 3] = bikePos.x; dp[i * 3 + 1] = 0; dp[i * 3 + 2] = bikePos.z; }
  }
  (dustLine.geometry as THREE.BufferGeometry).attributes.position.needsUpdate = true;
  (dustLine.material as THREE.LineBasicMaterial).opacity = 0.25;
}

export function updateTireTrail(bikePos: THREE.Vector3, curTan: THREE.Vector3, speed: number, airborne: boolean): void {
  if (speed > 1 && !airborne) {
    const lastTire = tireTrail[tireTrail.length - 1];
    const tx = bikePos.x - curTan.x * 0.4, tz = bikePos.z - curTan.z * 0.4;
    if (!lastTire || Math.hypot(tx - lastTire.x, tz - lastTire.z) > 0.3) {
      tireTrail.push({ x: tx, y: 0.02, z: tz });
      if (tireTrail.length >= TIRE_TRAIL_MAX) tireTrail.length = TIRE_TRAIL_MAX;
    }
  }
  const ttp = (tireTrailLine.geometry as THREE.BufferGeometry).attributes.position.array as Float32Array;
  for (let i = Math.max(0, tireTrail.length - 4); i < tireTrail.length; i++) {
    ttp[i * 3] = tireTrail[i].x; ttp[i * 3 + 1] = tireTrail[i].y; ttp[i * 3 + 2] = tireTrail[i].z;
  }
  (tireTrailLine.geometry as THREE.BufferGeometry).attributes.position.needsUpdate = true;
  (tireTrailLine.geometry as THREE.BufferGeometry).setDrawRange(0, tireTrail.length);
  (tireTrailLine.material as THREE.LineBasicMaterial).opacity = 0.1;
}

export function updateRoostParticles(dt: number, speed: number, bikeGrounded: boolean, bikePos: THREE.Vector3, curTan: THREE.Vector3, trackH: number): void {
  if (speed > 3 && bikeGrounded) {
    const roostCount = speed > 10 ? 3 : speed > 6 ? 2 : 1;
    for (let r = 0; r < roostCount && mxRoostParts.length < MX_ROOST_MAX; r++) {
      const spread = 0.15 + speed * 0.02;
      mxRoostParts.push({
        x: bikePos.x - curTan.x * 0.6 + (Math.random() - 0.5) * 0.3,
        y: trackH + 0.1,
        z: bikePos.z - curTan.z * 0.6 + (Math.random() - 0.5) * 0.3,
        vx: -curTan.x * 0.1 + (Math.random() - 0.5) * spread,
        vy: 0.15 + Math.random() * 0.25 + speed * 0.015,
        vz: -curTan.z * 0.1 + (Math.random() - 0.5) * spread,
        life: 0.6 + Math.random() * 0.5, ml: 0.6 + Math.random() * 0.5,
      });
    }
  }
  for (let i = mxRoostParts.length - 1; i >= 0; i--) {
    const p = mxRoostParts[i];
    p.vy -= 6 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    p.vx *= 0.97; p.vz *= 0.97; p.life -= dt;
    if (p.life <= 0 || p.y < -0.1) mxRoostParts.splice(i, 1);
  }
  const rrp = mxRoostGeo.attributes.position.array as Float32Array;
  const rrs = mxRoostGeo.attributes.size.array as Float32Array;
  for (let i = 0; i < MX_ROOST_MAX; i++) {
    if (i < mxRoostParts.length) {
      const p = mxRoostParts[i]; rrp[i * 3] = p.x; rrp[i * 3 + 1] = p.y; rrp[i * 3 + 2] = p.z;
      rrs[i] = (p.life / p.ml) * 0.25;
    } else { rrp[i * 3] = 0; rrp[i * 3 + 1] = -10; rrp[i * 3 + 2] = 0; rrs[i] = 0; }
  }
  mxRoostGeo.attributes.position.needsUpdate = true;
  mxRoostGeo.attributes.size.needsUpdate = true;
}

export function updateAmbientParticles(dt: number, t: number, bikePos: THREE.Vector3): void {
  if (mxAmbientParts.length < MX_AMB_MAX && Math.random() > 0.85) {
    const ang = Math.random() * Math.PI * 2; const dist = 8 + Math.random() * 20;
    mxAmbientParts.push({
      x: bikePos.x + Math.cos(ang) * dist, y: 0.5 + Math.random() * 3,
      z: bikePos.z + Math.sin(ang) * dist,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.1,
      vz: (Math.random() - 0.5) * 0.3,
      life: 8 + Math.random() * 6, ml: 8 + Math.random() * 6,
    });
  }
  for (let i = mxAmbientParts.length - 1; i >= 0; i--) {
    const p = mxAmbientParts[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    p.vy += Math.sin(t * 0.5 + i) * 0.01 * dt; p.life -= dt;
    if (p.life <= 0) mxAmbientParts.splice(i, 1);
  }
  const amp = mxAmbGeo.attributes.position.array as Float32Array;
  const ams = mxAmbGeo.attributes.size.array as Float32Array;
  for (let i = 0; i < MX_AMB_MAX; i++) {
    if (i < mxAmbientParts.length) {
      const p = mxAmbientParts[i]; amp[i * 3] = p.x; amp[i * 3 + 1] = p.y; amp[i * 3 + 2] = p.z;
      ams[i] = Math.min(p.life / p.ml, 1) * 0.15;
    } else { amp[i * 3] = 0; amp[i * 3 + 1] = -10; amp[i * 3 + 2] = 0; ams[i] = 0; }
  }
  mxAmbGeo.attributes.position.needsUpdate = true;
  mxAmbGeo.attributes.size.needsUpdate = true;
}
