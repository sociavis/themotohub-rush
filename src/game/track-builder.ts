import * as THREE from 'three';
import { MX_TRACKS, TRACK_W, MX_CHECKPOINTS } from './tracks';
import { scene, applyAtmosphere } from './renderer';
import { bikeGroup } from './bike';
import { makeTrackTexture, makeCheckerTexture, makeBannerTexture, makeSideBannerTexture, makeCrowdTexture, makeGlowSprite } from './textures';
import type { TrackDef } from './types';

// ── Track State ──
export let mxTrackIdx = 0;
export let mxSpline: THREE.CatmullRomCurve3 | null = null;
export let mxSplineLen = 0;
export let mxTrackMeshes: THREE.Object3D[] = [];
export let mxCPMeshes: { userData: { cpIdx: number; cpT: number } }[] = [];
export let mxFinishMesh: THREE.Mesh | null = null;

export function setTrackIdx(idx: number): void { mxTrackIdx = idx; }
export function nextTrack(): void { mxTrackIdx = (mxTrackIdx + 1) % MX_TRACKS.length; }

// ── S4 Group (the race world) ──
export const s4 = new THREE.Group();
scene.add(s4);

// ── Dust Trail (legacy line — hidden in the realistic look) ──
const dustGeo = new THREE.BufferGeometry();
const dustPos = new Float32Array(30 * 3);
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
dustGeo.setDrawRange(0, 0);
export const dustLine = new THREE.Line(
  dustGeo,
  new THREE.LineBasicMaterial({ color: 0x6e5540, transparent: true, opacity: 0 }),
);
dustLine.visible = false;
export const dustTrail: { x: number; y: number; z: number }[] = [];

// ── Tire marks: fading rubber ribbon laid along the bike's real line ──
export const TIRE_TRAIL_MAX = 2200;
interface TireMark { x: number; y: number; z: number; nx: number; nz: number; a: number; age: number; d: number }
export const tireTrail: TireMark[] = [];
const TIRE_W = 0.15;         // half mark width
const TIRE_LIFE = 42;        // seconds until fully faded
const ttGeo = new THREE.BufferGeometry();
const ttPos = new Float32Array(TIRE_TRAIL_MAX * 2 * 3);
const ttAlpha = new Float32Array(TIRE_TRAIL_MAX * 2);
{
  const idx = new Uint32Array((TIRE_TRAIL_MAX - 1) * 6);
  for (let i = 0; i < TIRE_TRAIL_MAX - 1; i++) {
    const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
    idx.set([a, b, c, b, d, c], i * 6);
  }
  ttGeo.setIndex(new THREE.BufferAttribute(idx, 1));
}
const ttDist = new Float32Array(TIRE_TRAIL_MAX * 2);
const ttSide = new Float32Array(TIRE_TRAIL_MAX * 2);
ttGeo.setAttribute('position', new THREE.BufferAttribute(ttPos, 3));
ttGeo.setAttribute('aAlpha', new THREE.BufferAttribute(ttAlpha, 1));
ttGeo.setAttribute('aDist', new THREE.BufferAttribute(ttDist, 1));
ttGeo.setAttribute('aSide', new THREE.BufferAttribute(ttSide, 1));
ttGeo.setDrawRange(0, 0);
const ttMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  uniforms: {},
  vertexShader: `attribute float aAlpha; attribute float aDist; attribute float aSide;
    varying float vA; varying float vD; varying float vS;
    void main(){ vA = aAlpha; vD = aDist; vS = aSide;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  // Knobby dirtbike print: staggered blocks — shoulder knob columns plus an
  // offset centre column, dug-in dark edges
  fragmentShader: `varying float vA; varying float vD; varying float vS;
    void main(){
      float rows = vD * 3.0;
      float shoulder = step(0.42, abs(vS));
      float centre = 1.0 - step(0.30, abs(vS));
      float dashS = step(fract(rows), 0.55);
      float dashC = step(fract(rows + 0.5), 0.5);
      float knob = max(shoulder * dashS, centre * dashC);
      if (knob < 0.5) discard;
      gl_FragColor = vec4(0.12, 0.08, 0.045, vA);
    }`,
});
export const tireTrailMesh = new THREE.Mesh(ttGeo, ttMat);
tireTrailMesh.frustumCulled = false;
tireTrailMesh.renderOrder = 1;
s4.add(tireTrailMesh);

// ── Ambient Dust Motes ──
export const mxAmbientParts: { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; ml: number }[] = [];
export const MX_AMB_MAX = 60;
const mxAmbGeo = new THREE.BufferGeometry();
const mxAmbPos = new Float32Array(MX_AMB_MAX * 3);
const mxAmbSz = new Float32Array(MX_AMB_MAX);
mxAmbGeo.setAttribute('position', new THREE.BufferAttribute(mxAmbPos, 3));
mxAmbGeo.setAttribute('size', new THREE.BufferAttribute(mxAmbSz, 1));
mxAmbGeo.setDrawRange(0, 0);
const softDot = makeGlowSprite('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
export const mxAmbMat = new THREE.PointsMaterial({ color: 0xcbb490, transparent: true, opacity: 0.18, size: 0.15, sizeAttenuation: true, map: softDot, depthWrite: false });
export const mxAmbPoints = new THREE.Points(mxAmbGeo, mxAmbMat);
mxAmbPoints.visible = false;
mxAmbPoints.frustumCulled = false;
s4.add(mxAmbPoints);

// ── Roost (dirt thrown by the rear wheel) ──
export const mxRoostParts: { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; ml: number }[] = [];
export const MX_ROOST_MAX = 160;
const mxRoostGeo = new THREE.BufferGeometry();
const mxRoostPos = new Float32Array(MX_ROOST_MAX * 3);
const mxRoostSz = new Float32Array(MX_ROOST_MAX);
mxRoostGeo.setAttribute('position', new THREE.BufferAttribute(mxRoostPos, 3));
mxRoostGeo.setAttribute('size', new THREE.BufferAttribute(mxRoostSz, 1));
mxRoostGeo.setDrawRange(0, 0);
export const mxRoostMat = new THREE.PointsMaterial({ color: 0x6e5238, transparent: true, opacity: 0.85, size: 0.28, sizeAttenuation: true, map: softDot, depthWrite: false });
export const mxRoostPoints = new THREE.Points(mxRoostGeo, mxRoostMat);
mxRoostPoints.visible = false;
mxRoostPoints.frustumCulled = false;
s4.add(mxRoostPoints);

// Add bike to s4
s4.add(bikeGroup);

// ── Precomputed Height / Berm LUTs ──
const TRACK_LUT_RES = 2000;
const _heightLUT = new Float32Array(TRACK_LUT_RES + 1);
const _bermLUT = new Float32Array(TRACK_LUT_RES + 1);

// smoothstep 0..1
const sstep = (p: number) => p <= 0 ? 0 : p >= 1 ? 1 : p * p * (3 - 2 * p);

// Height profile of one obstacle at local progress p (0..1 across its length).
// Returns height in world units.
function obstacleProfile(ob: import('./types').TrackObstacle, p: number): number {
  const H = ob.h || 2;
  switch (ob.type) {
    case 'hill':
      return H * (1 - Math.cos(p * Math.PI * 2)) / 2;
    case 'tabletop': {
      // 30% face up, 40% deck, 30% landing ramp
      if (p < 0.3) return H * sstep(p / 0.3);
      if (p < 0.7) return H;
      return H * sstep((1 - p) / 0.3);
    }
    case 'double': {
      // steep takeoff (0-25%), gap dips to 30% (25-55%), landing knuckle + downramp
      if (p < 0.25) return H * sstep(p / 0.25);
      if (p < 0.55) {
        const g = (p - 0.25) / 0.3;
        return H * (1 - Math.sin(g * Math.PI) * 0.7);
      }
      if (p < 0.7) return H * (0.3 + 0.7 * sstep((p - 0.55) / 0.15)); // rise to landing crest
      return H * sstep((1 - p) / 0.3);
    }
    case 'whoops': {
      const n = ob.count || 6;
      // envelope fades bumps in/out at section edges
      const env = Math.sin(p * Math.PI);
      return H * env * (1 - Math.cos(p * n * Math.PI * 2)) / 2;
    }
    case 'rhythm': {
      const n = ob.count || 4;
      const env = Math.sin(p * Math.PI);
      // alternating amplitude: small, big, small, big…
      const cyc = p * n;
      const amp = Math.floor(cyc) % 2 === 0 ? 0.55 : 1;
      return H * env * amp * (1 - Math.cos((cyc % 1) * Math.PI * 2)) / 2;
    }
    default:
      return 0;
  }
}

function buildTrackLUT(): void {
  const trk = MX_TRACKS[mxTrackIdx];
  for (let i = 0; i <= TRACK_LUT_RES; i++) {
    const tP = i / TRACK_LUT_RES;
    let h = 0, b = 0;
    for (const ob of trk.obs) {
      if (ob.type === 'berm') {
        const w = ob.len || 0.06;
        if (tP >= ob.at && tP < ob.at + w) {
          const p = (tP - ob.at) / w;
          b = (ob.side || 0) * Math.sin(p * Math.PI) * 0.4;
        }
      } else {
        const spread = ob.len || 0.12;
        if (tP >= ob.at && tP <= ob.at + spread) {
          const p = (tP - ob.at) / spread;
          h = Math.max(h, obstacleProfile(ob, p));
        }
      }
    }
    _heightLUT[i] = h;
    _bermLUT[i] = b;
  }
}

export function getTrackHeight(tParam: number): number {
  // wrap + linear interpolation — physics reads slopes from this, steps hurt
  const tw = ((tParam % 1) + 1) % 1;
  const f = tw * TRACK_LUT_RES;
  const i0 = Math.floor(f);
  const i1 = Math.min(i0 + 1, TRACK_LUT_RES);
  const fr = f - i0;
  return _heightLUT[i0] * (1 - fr) + _heightLUT[i1] * fr;
}

export function getBerm(tParam: number): number {
  const tw = ((tParam % 1) + 1) % 1;
  const idx = Math.round(tw * TRACK_LUT_RES);
  return _bermLUT[Math.min(idx, TRACK_LUT_RES)];
}

// Banked-corner surface rise. Berms are carved into the track itself as
// superelevation: the outer half of the surface cups upward (quadratic bowl).
// u is the cross-track position, -1 (right edge) .. +1 (left edge).
export const BERM_H = 1.25;
export function getBermRise(tParam: number, u: number): number {
  const b = getBerm(tParam);
  if (b === 0) return 0;
  const side = Math.sign(b);
  const mag = Math.min(1, Math.abs(b) / 0.4);
  const x = Math.max(0, Math.min(1, u * side));
  return mag * BERM_H * x * x;
}

// ── Per-environment styling ──
interface EnvStyle {
  trackBase: string; trackRut: string;
  dirt: number;            // roost / dust color
  stakeAccent: number;
}

const ENV_STYLES: Record<TrackDef['envType'], EnvStyle> = {
  desert:   { trackBase: '#8a6a42', trackRut: '#5e462c', dirt: 0x9c7c50, stakeAccent: 0xe33a1e },
  ice:      { trackBase: '#6e5540', trackRut: '#4a3828', dirt: 0xd8dee6, stakeAccent: 0x2a5fb0 },
  neon:     { trackBase: '#5c4632', trackRut: '#3e2f20', dirt: 0x60492f, stakeAccent: 0xe33a1e },
  volcanic: { trackBase: '#55423a', trackRut: '#392b24', dirt: 0x5b463c, stakeAccent: 0xe37a1e },
  jungle:   { trackBase: '#5a4a2e', trackRut: '#3c301c', dirt: 0x62502f, stakeAccent: 0xe33a1e },
  stadium:  { trackBase: '#6e5138', trackRut: '#4a3423', dirt: 0x75583a, stakeAccent: 0xe33a1e },
};

const trackTexCache: Record<string, THREE.CanvasTexture> = {};

function trackTex(env: TrackDef['envType']): THREE.CanvasTexture {
  if (!trackTexCache[env]) {
    trackTexCache[env] = makeTrackTexture(ENV_STYLES[env].trackBase, ENV_STYLES[env].trackRut);
  }
  return trackTexCache[env];
}

// shared small-geometry caches
const checkerTex = makeCheckerTexture(6);

function disposeMesh(m: THREE.Object3D): void {
  const anyM = m as any;
  if (anyM.geometry) anyM.geometry.dispose();
}

// ── Build Track ──
export function buildTrack(): void {
  // Clean up old meshes
  mxTrackMeshes.forEach(m => { s4.remove(m); disposeMesh(m); });
  mxCPMeshes = [];
  if (mxFinishMesh) { s4.remove(mxFinishMesh); mxFinishMesh.geometry.dispose(); mxFinishMesh = null; }
  mxTrackMeshes = [];

  const trk = MX_TRACKS[mxTrackIdx];
  const style = ENV_STYLES[trk.envType];

  // Center at origin
  let centX = 0, centZ = 0;
  for (const p of trk.pts) { centX += p[0]; centZ += p[1]; }
  centX /= trk.pts.length; centZ /= trk.pts.length;
  // Chaikin corner-cutting (×2) rounds every corner before the spline sees
  // it — kills curvature spikes that made steering jerky on tight layouts
  let poly: [number, number][] = trk.pts.map(p => [p[0] - centX, p[1] - centZ]);
  for (let it = 0; it < 3; it++) {
    const out: [number, number][] = [];
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n];
      out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]);
      out.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    poly = out;
  }
  const pts3d = poly.map(p => new THREE.Vector3(p[0], 0, p[1]));
  mxSpline = new THREE.CatmullRomCurve3(pts3d, true, 'chordal');
  mxSplineLen = mxSpline.getLength();
  buildTrackLUT();
  trackSamples = [];
  for (let i = 0; i < 140; i++) trackSamples.push(mxSpline.getPointAt(i / 140));
  trackR = 0;
  for (const sp of trackSamples) trackR = Math.max(trackR, Math.hypot(sp.x, sp.z));
  trackR += TRACK_W;
  const t0pt = mxSpline.getPointAt(0);
  const t0tan = mxSpline.getTangentAt(0).normalize();
  startZone.set(t0pt.x - t0tan.x * 5, 0, t0pt.z - t0tan.z * 5);

  const RES = 900;
  const leftPts: THREE.Vector3[] = [], rightPts: THREE.Vector3[] = [];
  const tangents: THREE.Vector3[] = [], normals: THREE.Vector3[] = [], centers: THREE.Vector3[] = [];
  for (let i = 0; i <= RES; i++) {
    const tP = i / RES;
    const pt = mxSpline.getPointAt(tP);
    const tan = mxSpline.getTangentAt(tP).normalize();
    const norm = new THREE.Vector3(-tan.z, 0, tan.x);
    const h = getTrackHeight(tP);
    tangents.push(tan); normals.push(norm); centers.push(new THREE.Vector3(pt.x, h, pt.z));
    leftPts.push(new THREE.Vector3(pt.x + norm.x * TRACK_W, h + getBermRise(tP, 1), pt.z + norm.z * TRACK_W));
    rightPts.push(new THREE.Vector3(pt.x - norm.x * TRACK_W, h + getBermRise(tP, -1), pt.z - norm.z * TRACK_W));
  }

  // ── Racing surface: 4 columns across so banked corners read as bowls ──
  const COLS = [1, 0.33, -0.33, -1];   // u across the track (left → right)
  const sv: number[] = [], si: number[] = [], suv: number[] = [];
  const vRepeat = mxSplineLen / 5;
  for (let i = 0; i <= RES; i++) {
    const tP = i / RES;
    for (const u of COLS) {
      const px = centers[i].x + normals[i].x * TRACK_W * u;
      const pz = centers[i].z + normals[i].z * TRACK_W * u;
      const py = centers[i].y + getBermRise(tP, u) + 0.02;
      sv.push(px, py, pz);
      suv.push((1 - u) / 2, tP * vRepeat);
    }
  }
  const C = COLS.length;
  for (let i = 0; i < RES; i++) {
    for (let c2 = 0; c2 < C - 1; c2++) {
      const a = i * C + c2, b = a + 1, c3 = (i + 1) * C + c2, d = c3 + 1;
      si.push(a, b, c3, b, d, c3);
    }
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sv, 3));
  sg.setAttribute('uv', new THREE.Float32BufferAttribute(suv, 2));
  sg.setIndex(si);
  sg.computeVertexNormals();
  const surfMesh = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({
    map: trackTex(trk.envType), roughness: 1, metalness: 0, side: THREE.DoubleSide,
  }));
  surfMesh.receiveShadow = true;
  s4.add(surfMesh); mxTrackMeshes.push(surfMesh);

  // ── Shoulders / aprons blending into the terrain ──
  const APRON_W = 2.4;
  for (const side of [1, -1]) {
    const av: number[] = [], ai: number[] = [], auv: number[] = [];
    for (let i = 0; i <= RES; i++) {
      const edge = side > 0 ? leftPts[i] : rightPts[i];
      const n = normals[i];
      av.push(edge.x, edge.y + 0.015, edge.z);
      av.push(edge.x + n.x * APRON_W * side, Math.max(edge.y * 0.35, 0), edge.z + n.z * APRON_W * side);
      auv.push(0, (i / RES) * vRepeat, 1, (i / RES) * vRepeat);
    }
    for (let i = 0; i < RES; i++) {
      const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
      ai.push(a, b, c, b, d, c);
    }
    const ag = new THREE.BufferGeometry();
    ag.setAttribute('position', new THREE.Float32BufferAttribute(av, 3));
    ag.setAttribute('uv', new THREE.Float32BufferAttribute(auv, 2));
    ag.setIndex(ai);
    ag.computeVertexNormals();
    const apron = new THREE.Mesh(ag, new THREE.MeshStandardMaterial({
      color: 0xcfc2ae, map: trackTex(trk.envType), roughness: 1, metalness: 0, side: THREE.DoubleSide,
    }));
    apron.receiveShadow = true;
    s4.add(apron); mxTrackMeshes.push(apron);
  }

  // ── Berm markers: tire stacks at entry/exit (bank itself is now carved
  // into the track surface as superelevation) ──
  for (const ob of trk.obs) {
    if (ob.type !== 'berm') continue;
    const w = ob.len || 0.06;
    // tire stacks marking the berm entry + exit
    for (const tEnd of [ob.at - 0.005, ob.at + w + 0.005]) {
      const pt = mxSpline.getPointAt((tEnd + 1) % 1);
      const tan = mxSpline.getTangentAt((tEnd + 1) % 1).normalize();
      const norm = new THREE.Vector3(-tan.z, 0, tan.x);
      const offset = (ob.side || 0) > 0 ? TRACK_W : -TRACK_W;
      const h = getTrackHeight((tEnd + 1) % 1) + getBermRise((tEnd + 1) % 1, (ob.side || 0) > 0 ? 1 : -1);
      const bx = pt.x + norm.x * offset * 1.25, bz = pt.z + norm.z * offset * 1.25;
      for (let s = 0; s < 3; s++) {
        const tireM = new THREE.Mesh(
          new THREE.TorusGeometry(0.17 - s * 0.015, 0.06, 8, 16),
          new THREE.MeshStandardMaterial({ color: s === 2 ? 0xd8d4cc : 0x1c1c1e, roughness: 0.9 }),
        );
        tireM.rotation.x = Math.PI / 2;
        tireM.position.set(bx, h + 0.06 + s * 0.11, bz);
        tireM.castShadow = true;
        s4.add(tireM); mxTrackMeshes.push(tireM);
      }
    }
  }

  // ── Finish line: checkered strip + overhead gate ──
  const fp = mxSpline.getPointAt(0);
  const fTan = mxSpline.getTangentAt(0).normalize();
  const fNorm = new THREE.Vector3(-fTan.z, 0, fTan.x);
  const fh = getTrackHeight(0);
  // crossAngle: long axis spans ACROSS the track (along the normal)
  const crossAngle = Math.atan2(fNorm.x, fNorm.z);

  const finTex = checkerTex.clone();
  finTex.needsUpdate = true;
  finTex.repeat.set(1, 5);
  const finMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.03, TRACK_W * 2),
    new THREE.MeshStandardMaterial({ map: finTex, roughness: 0.9 }),
  );
  finMesh.position.set(fp.x, fh + 0.05, fp.z);
  finMesh.rotation.y = crossAngle;
  s4.add(finMesh); mxTrackMeshes.push(finMesh);
  mxFinishMesh = finMesh;

  // gate posts + banner
  const gate = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0x30323a, roughness: 0.5, metalness: 0.5 });
  for (const side of [1, -1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 3.5, 10), postMat);
    post.position.set(side * (TRACK_W + 0.6), 1.75, 0);
    post.castShadow = true;
    gate.add(post);
  }
  const bannerW = TRACK_W * 2 + 1.2;
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(bannerW, 0.55),
    new THREE.MeshStandardMaterial({ map: makeBannerTexture('THEMOTOHUB RUSH', '#c1272d'), side: THREE.DoubleSide, roughness: 0.8 }),
  );
  banner.position.set(0, 3.22, 0);
  gate.add(banner);
  gate.position.set(fp.x, fh, fp.z);
  // posts sit on local X → rotate so local X maps onto the track normal
  gate.rotation.y = crossAngle - Math.PI / 2;
  s4.add(gate); mxTrackMeshes.push(gate);

  // Invisible checkpoints
  for (let i = 0; i < MX_CHECKPOINTS; i++) {
    const cpT = (i + 1) / (MX_CHECKPOINTS + 1);
    mxCPMeshes.push({ userData: { cpIdx: i, cpT } });
  }

  // ── Course stakes along both edges ──
  const STAKES = 44;
  const stakeGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.3, 6);
  const stakeMat = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.6 });
  const capGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.07, 6);
  const capMat = new THREE.MeshStandardMaterial({ color: style.stakeAccent, roughness: 0.6 });
  for (let i = 0; i < STAKES; i++) {
    const tP = i / STAKES;
    if (Math.abs(tP) < 0.012 || tP > 0.988) continue; // clear the gate
    const pt = mxSpline.getPointAt(tP);
    const tan = mxSpline.getTangentAt(tP).normalize();
    const norm = new THREE.Vector3(-tan.z, 0, tan.x);
    const h = getTrackHeight(tP);
    for (const side of [1.15, -1.15]) {
      const stake = new THREE.Mesh(stakeGeo, stakeMat);
      stake.position.set(pt.x + norm.x * TRACK_W * side, h + 0.15, pt.z + norm.z * TRACK_W * side);
      stake.castShadow = true;
      s4.add(stake); mxTrackMeshes.push(stake);
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(stake.position.x, h + 0.31, stake.position.z);
      s4.add(cap); mxTrackMeshes.push(cap);
    }
  }

  // Environment + atmosphere
  buildEnvironment(trk);
  setAtmosphere(trk);

  // Particle colors follow the dirt
  mxRoostMat.color.set(style.dirt);
  mxAmbMat.color.set(style.dirt);
}

// ── Environment props ──

function addProp(m: THREE.Object3D, shadow = true): void {
  m.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = shadow; });
  s4.add(m); mxTrackMeshes.push(m);
}

function stdMat(color: number, roughness = 0.9, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

// Sampled spline points so props never land on the racing line
let trackSamples: THREE.Vector3[] = [];
// Bounding radius of the current layout — horizon props stay beyond this
let trackR = 60;
// Zone behind the start line where the chase camera sits at the gate drop
const startZone = new THREE.Vector3();

function farFromTrack(x: number, z: number, margin = TRACK_W + 1.8): boolean {
  const szx = startZone.x - x, szz = startZone.z - z;
  if (szx * szx + szz * szz < 8 * 8) return false;
  const m2 = margin * margin;
  for (const p of trackSamples) {
    const dx = p.x - x, dz = p.z - z;
    if (dx * dx + dz * dz < m2) return false;
  }
  return true;
}

function ring(count: number, minD: number, maxD: number, fn: (x: number, z: number, i: number) => void, margin = TRACK_W + 1.8): void {
  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const ang = (i / count) * Math.PI * 2 + Math.random() * 0.6;
      const dist = minD + Math.random() * (maxD - minD);
      const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
      if (farFromTrack(x, z, margin)) { fn(x, z, i); break; }
    }
  }
}

// Horizon-scale scenery (mesas, mountains, towers): placed BEYOND the track's
// bounding radius so big silhouettes never occlude the racing line.
function horizonRing(count: number, gapMin: number, gapMax: number, fn: (x: number, z: number, i: number) => void): void {
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const dist = trackR + gapMin + Math.random() * (gapMax - gapMin);
    fn(Math.cos(ang) * dist, Math.sin(ang) * dist, i);
  }
}

function makePine(snowy: boolean): THREE.Group {
  const g = new THREE.Group();
  const trunkH = 0.8 + Math.random() * 0.8;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, trunkH, 7), stdMat(0x4a3626));
  trunk.position.y = trunkH / 2;
  g.add(trunk);
  const tiers = 3;
  const baseR = 1.0 + Math.random() * 0.7;
  const tierH = 1.2 + Math.random() * 0.6;
  for (let i = 0; i < tiers; i++) {
    const r = baseR * (1 - i * 0.28);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, tierH, 8), stdMat(snowy ? 0x2e4a38 : 0x2c5432));
    cone.position.y = trunkH + i * tierH * 0.62 + tierH / 2;
    g.add(cone);
    if (snowy) {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.7, tierH * 0.35, 8), stdMat(0xeef2f6, 0.95));
      cap.position.y = trunkH + i * tierH * 0.62 + tierH * 0.85;
      g.add(cap);
    }
  }
  return g;
}

function makeLeafTree(): THREE.Group {
  const g = new THREE.Group();
  const trunkH = 1.6 + Math.random() * 1.6;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, trunkH, 7), stdMat(0x53402c));
  trunk.position.y = trunkH / 2;
  g.add(trunk);
  const canopyR = 1.1 + Math.random() * 1.2;
  const gr = 0x3e6b2e + ((Math.random() * 0x001800) | 0);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(canopyR, 9, 7), stdMat(gr));
  canopy.position.y = trunkH + canopyR * 0.55;
  canopy.scale.y = 0.85;
  g.add(canopy);
  const canopy2 = new THREE.Mesh(new THREE.SphereGeometry(canopyR * 0.6, 8, 6), stdMat(gr + 0x000a00));
  canopy2.position.set(canopyR * 0.5, trunkH + canopyR * 0.35, canopyR * 0.3);
  g.add(canopy2);
  return g;
}

function makeRock(size: number, color: number): THREE.Mesh {
  const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 0), stdMat(color, 0.95));
  rock.scale.set(1, 0.6 + Math.random() * 0.5, 1);
  rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  return rock;
}

function makeFloodTower(x: number, z: number, withLight: boolean): THREE.Group {
  const g = new THREE.Group();
  const h = 9 + Math.random() * 2;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, h, 8), stdMat(0x3a3d44, 0.5, 0.6));
  pole.position.y = h / 2;
  g.add(pole);
  const headBox = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 0.25),
    new THREE.MeshStandardMaterial({ color: 0x22242a, emissive: 0xfff6d8, emissiveIntensity: 1.6, roughness: 0.4 }));
  headBox.position.y = h;
  headBox.lookAt(0, 0, 0);
  g.add(headBox);
  if (withLight) {
    const spot = new THREE.SpotLight(0xfff2d0, 1600, 90, 0.75, 0.55, 1.5);
    spot.position.set(0, h, 0);
    spot.target.position.set(-x * 0.7, 0, -z * 0.7);
    g.add(spot);
    g.add(spot.target);
  }
  g.position.set(x, 0, z);
  return g;
}

function makeStandsRing(): void {
  const crowdTex = makeCrowdTexture();
  const crowdMat = new THREE.MeshStandardMaterial({
    map: crowdTex, emissive: 0xffffff, emissiveMap: crowdTex, emissiveIntensity: 0.4, roughness: 0.9,
  });
  const standCount = 10;
  for (let i = 0; i < standCount; i++) {
    const tP = i / standCount;
    const pt = mxSpline!.getPointAt(tP);
    const tan = mxSpline!.getTangentAt(tP).normalize();
    const norm = new THREE.Vector3(-tan.z, 0, tan.x);
    const side = i % 2 === 0 ? 1 : -1;
    // walk outward until the stand is clear of every part of the course
    let dist = TRACK_W * 4.2;
    let placed = false;
    for (let step = 0; step < 5; step++) {
      const sx = pt.x + norm.x * dist * side, sz = pt.z + norm.z * dist * side;
      if (farFromTrack(sx, sz, TRACK_W * 2.2)) { placed = true; break; }
      dist += TRACK_W * 1.4;
    }
    if (!placed) continue;
    const g = new THREE.Group();
    for (let tier = 0; tier < 2; tier++) {
      const stand = new THREE.Mesh(
        new THREE.BoxGeometry(4.2, 1.0, 1.1),
        tier === 0 ? stdMat(0x2c2e34, 0.8) : crowdMat,
      );
      stand.position.set(0, 0.5 + tier * 0.95, tier * 1.0);
      stand.rotation.x = -0.12;
      g.add(stand);
    }
    g.position.set(pt.x + norm.x * dist * side, 0, pt.z + norm.z * dist * side);
    g.lookAt(pt.x, 0, pt.z);
    addProp(g, false);
  }
}

function makeSideBanners(count: number, text: string, bg: string, fg: string): void {
  const tex = makeSideBannerTexture(text, bg, fg);
  for (let i = 0; i < count; i++) {
    const tP = (i + 0.5) / count;
    const pt = mxSpline!.getPointAt(tP);
    const tan = mxSpline!.getTangentAt(tP).normalize();
    const norm = new THREE.Vector3(-tan.z, 0, tan.x);
    const side = i % 2 === 0 ? 1 : -1;
    const h = getTrackHeight(tP);
    const bn = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 0.42),
      new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.85 }),
    );
    bn.position.set(pt.x + norm.x * (TRACK_W + 1.7) * side, h + 0.24, pt.z + norm.z * (TRACK_W + 1.7) * side);
    // banner width runs along the direction of travel
    bn.rotation.y = Math.atan2(-tan.z, tan.x);
    addProp(bn, false);
  }
}

function buildEnvironment(trk: TrackDef): void {
  if (trk.envType === 'desert') {
    // Mesas on the horizon
    horizonRing(9, 22, 48, (x, z) => {
      const mh = 4 + Math.random() * 7, mw = 8 + Math.random() * 14;
      const mesa = new THREE.Mesh(new THREE.CylinderGeometry(mw * 0.55, mw, mh, 7), stdMat(0xb0714a, 0.95));
      mesa.position.set(x, mh / 2 - 0.4, z);
      addProp(mesa, false);
    });
    // Rocks
    ring(16, 12, 40, (x, z) => {
      const rock = makeRock(0.25 + Math.random() * 0.8, 0xa5764e);
      rock.position.set(x, 0.12, z);
      addProp(rock);
    });
    // Saguaro cacti
    ring(10, 14, 38, (x, z) => {
      const g = new THREE.Group();
      const h = 1.6 + Math.random() * 1.4;
      const mat = stdMat(0x4c7a3a, 0.85);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, h, 8), mat);
      trunk.position.y = h / 2;
      g.add(trunk);
      for (const sx of [1, -1]) {
        if (Math.random() > 0.4) {
          const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, h * 0.45, 7), mat);
          arm.position.set(sx * 0.28, h * 0.62, 0);
          arm.rotation.z = sx * 0.5;
          g.add(arm);
        }
      }
      g.position.set(x, 0, z);
      addProp(g);
    });
    // Dry brush
    ring(14, 8, 34, (x, z) => {
      const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22 + Math.random() * 0.25, 0), stdMat(0x8a7a44, 0.95));
      bush.position.set(x, 0.15, z);
      addProp(bush, false);
    });
    makeSideBanners(6, 'THEMOTOHUB', '#c1272d', '#ffffff');
  } else if (trk.envType === 'ice') {
    // Alpine: snowy pines + mountain backdrop
    ring(18, 12, 44, (x, z) => {
      const tree = makePine(true);
      tree.position.set(x, 0, z);
      addProp(tree);
    });
    horizonRing(8, 24, 50, (x, z) => {
      const mh = 12 + Math.random() * 16;
      const mtn = new THREE.Mesh(new THREE.ConeGeometry(mh * 0.75, mh, 7), stdMat(0xdde6ee, 0.95));
      mtn.position.set(x, mh / 2 - 1, z);
      addProp(mtn, false);
    });
    ring(10, 8, 30, (x, z) => {
      const rock = makeRock(0.2 + Math.random() * 0.5, 0x9aa4ae);
      rock.position.set(x, 0.1, z);
      addProp(rock);
    });
    makeSideBanners(6, 'GLACIER GP', '#1e3a5c', '#ffffff');
  } else if (trk.envType === 'neon') {
    // Night city supercross — skyline silhouettes + floodlights
    horizonRing(22, 18, 55, (x, z) => {
      const bh = 8 + Math.random() * 26, bw = 4 + Math.random() * 7;
      const bld = new THREE.Mesh(
        new THREE.BoxGeometry(bw, bh, bw),
        new THREE.MeshStandardMaterial({ color: 0x0d1420, emissive: 0x24304a, emissiveIntensity: 0.35, roughness: 0.9 }),
      );
      bld.position.set(x, bh / 2, z);
      bld.rotation.y = Math.random() * Math.PI * 0.5;
      addProp(bld, false);
    });
    let lit = 0;
    ring(4, TRACK_W * 4.5, TRACK_W * 6.5, (x, z) => {
      addProp(makeFloodTower(x, z, lit++ < 2), false);
    });
    makeSideBanners(8, 'NIGHT SX', '#101726', '#ffb25e');
  } else if (trk.envType === 'volcanic') {
    // Dusk canyon — dark rock spires, glowing vents
    horizonRing(14, 14, 40, (x, z) => {
      const rh = 3 + Math.random() * 8, rr = 0.8 + Math.random() * 2;
      const spire = new THREE.Mesh(new THREE.ConeGeometry(rr, rh, 6), stdMat(0x453029, 0.95));
      spire.position.set(x, rh / 2 - 0.3, z);
      spire.rotation.y = Math.random() * Math.PI;
      addProp(spire, false);
    });
    ring(16, 10, 36, (x, z) => {
      const rock = makeRock(0.25 + Math.random() * 0.7, 0x51392e);
      rock.position.set(x, 0.12, z);
      addProp(rock);
    });
    // Glow vents
    let vents = 0;
    ring(6, 12, 34, (x, z) => {
      const pool = new THREE.Mesh(new THREE.CircleGeometry(0.8 + Math.random() * 1.4, 14),
        new THREE.MeshStandardMaterial({ color: 0x201008, emissive: 0xff5a1e, emissiveIntensity: 1.8, roughness: 0.8 }));
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(x, 0.02, z);
      addProp(pool, false);
      if (vents++ < 3) {
        const glow = new THREE.PointLight(0xff6a2a, 14, 14, 1.8);
        glow.position.set(x, 0.8, z);
        addProp(glow as any, false);
      }
    });
    makeSideBanners(6, 'RIDGE RACE', '#3a1c12', '#ff9a4a');
  } else if (trk.envType === 'jungle') {
    // Forest — layered leafy trees + ferns, misty
    ring(20, 11, 42, (x, z) => {
      const tree = makeLeafTree();
      tree.position.set(x, 0, z);
      addProp(tree);
    });
    ring(14, 7, 30, (x, z) => {
      const fern = new THREE.Mesh(new THREE.ConeGeometry(0.3 + Math.random() * 0.35, 0.6 + Math.random() * 0.5, 6), stdMat(0x35692c, 0.9));
      fern.position.set(x, 0.25, z);
      addProp(fern, false);
    });
    ring(8, 9, 28, (x, z) => {
      const rock = makeRock(0.2 + Math.random() * 0.45, 0x6a6a5a);
      rock.position.set(x, 0.1, z);
      addProp(rock);
    });
    makeSideBanners(6, 'FOREST MX', '#1e4a26', '#ffffff');
  } else if (trk.envType === 'stadium') {
    // Night stadium — crowd stands + floodlights
    makeStandsRing();
    let lit = 0;
    ring(4, TRACK_W * 5, TRACK_W * 7, (x, z) => {
      addProp(makeFloodTower(x, z, lit++ < 2), false);
    });
    makeSideBanners(10, 'RUSH', '#c1272d', '#ffffff');
  }
}

function setAtmosphere(trk: TrackDef): void {
  if (trk.envType === 'desert') {
    applyAtmosphere({
      skyTop: 0x3f86d4, skyHorizon: 0xf2d5a0, fogColor: 0xe3cba0, fogDensity: 0.0032,
      sunColor: 0xfff1d6, sunIntensity: 2.4, sunPos: [55, 85, 25],
      hemiSky: 0xbcd7f0, hemiGround: 0xc9a06a, hemiIntensity: 0.85,
      groundKey: 'desert', groundBase: '#c9a06a', groundDark: '#a8814e',
      clouds: true, sunDisc: true,
    });
  } else if (trk.envType === 'ice') {
    applyAtmosphere({
      skyTop: 0x6aa4dc, skyHorizon: 0xe8eef4, fogColor: 0xdce8f2, fogDensity: 0.004,
      sunColor: 0xeef4ff, sunIntensity: 1.9, sunPos: [40, 60, 50],
      hemiSky: 0xcfe0f2, hemiGround: 0xdde6ee, hemiIntensity: 0.9,
      groundKey: 'snow', groundBase: '#e8edf2', groundDark: '#c8d4de',
      clouds: true, sunDisc: true,
    });
  } else if (trk.envType === 'neon') {
    applyAtmosphere({
      skyTop: 0x040713, skyHorizon: 0x3a2c46, fogColor: 0x0c0e18, fogDensity: 0.0045,
      sunColor: 0x8ea6d8, sunIntensity: 0.5, sunPos: [-40, 70, -30],
      hemiSky: 0x2a3450, hemiGround: 0x1a1410, hemiIntensity: 0.5,
      groundKey: 'nightlot', groundBase: '#4a4438', groundDark: '#38332a',
      clouds: false, sunDisc: false, exposure: 1.15,
    });
  } else if (trk.envType === 'volcanic') {
    applyAtmosphere({
      skyTop: 0x2a1a2e, skyHorizon: 0xd97a36, fogColor: 0x66392a, fogDensity: 0.0042,
      sunColor: 0xff9a5e, sunIntensity: 1.5, sunPos: [-60, 22, 40],
      hemiSky: 0x6a4458, hemiGround: 0x53392e, hemiIntensity: 0.6,
      groundKey: 'volcanic', groundBase: '#5c4438', groundDark: '#44322a',
      clouds: false, sunDisc: true,
    });
  } else if (trk.envType === 'jungle') {
    applyAtmosphere({
      skyTop: 0x6fb0dd, skyHorizon: 0xd8e8c4, fogColor: 0xc4d8b4, fogDensity: 0.0058,
      sunColor: 0xfff4cc, sunIntensity: 2.0, sunPos: [30, 70, 45],
      hemiSky: 0xc2dcc8, hemiGround: 0x4c6b35, hemiIntensity: 0.9,
      groundKey: 'grass', groundBase: '#5d7a3c', groundDark: '#48632e',
      clouds: true, sunDisc: true,
    });
  } else if (trk.envType === 'stadium') {
    applyAtmosphere({
      skyTop: 0x05070f, skyHorizon: 0x1c2438, fogColor: 0x0b0e18, fogDensity: 0.0038,
      sunColor: 0xbccae8, sunIntensity: 0.65, sunPos: [30, 80, -40],
      hemiSky: 0x323c58, hemiGround: 0x241a12, hemiIntensity: 0.55,
      groundKey: 'stadium', groundBase: '#6e5138', groundDark: '#543d29',
      clouds: false, sunDisc: false, exposure: 1.12,
    });
  }
}

export function setVis(): void {
  s4.visible = true;
  bikeGroup.visible = true;
  tireTrailMesh.visible = true;
  mxAmbPoints.visible = true;
  mxRoostPoints.visible = true;
  mxTrackMeshes.forEach(m => (m as any).visible = true);
}

export function updateDustTrail(_bikePos: THREE.Vector3, _curTan: THREE.Vector3, _trackH: number, _speed: number, _bikeGrounded: boolean): void {
  // Legacy no-op — dust is now handled by the roost particle system.
}

export function updateTireTrail(bikePos: THREE.Vector3, curTan: THREE.Vector3, speed: number, airborne: boolean, intensity = 0.5, dt = 1 / 60): void {
  // drop a mark behind the rear wheel while planted
  if (speed > 2 && !airborne) {
    const last = tireTrail[tireTrail.length - 1];
    const tx = bikePos.x - curTan.x * 0.42, tz = bikePos.z - curTan.z * 0.42;
    if (!last || Math.hypot(tx - last.x, tz - last.z) > 0.28) {
      if (tireTrail.length >= TIRE_TRAIL_MAX) tireTrail.shift();
      // perpendicular for the quad strip
      const nx = -curTan.z, nz = curTan.x;
      const dist = last ? last.d + Math.hypot(tx - last.x, tz - last.z) : 0;
      tireTrail.push({ x: tx, y: bikePos.y - 0.315, z: tz, nx, nz, a: Math.min(0.7, 0.3 + intensity * 0.5), age: 0, d: dist });
    }
  }
  // age + rebuild ribbon
  const n = tireTrail.length;
  for (let i = 0; i < n; i++) {
    const m = tireTrail[i];
    m.age += dt;
    const fade = Math.max(0, 1 - m.age / TIRE_LIFE);
    const alpha = m.a * fade;
    const j = i * 2;
    ttPos[j * 3] = m.x + m.nx * TIRE_W; ttPos[j * 3 + 1] = m.y; ttPos[j * 3 + 2] = m.z + m.nz * TIRE_W;
    ttPos[j * 3 + 3] = m.x - m.nx * TIRE_W; ttPos[j * 3 + 4] = m.y; ttPos[j * 3 + 5] = m.z - m.nz * TIRE_W;
    ttAlpha[j] = alpha; ttAlpha[j + 1] = alpha;
    ttDist[j] = m.d; ttDist[j + 1] = m.d;
    ttSide[j] = 1; ttSide[j + 1] = -1;
    // break the strip across gaps (respawn/teleport) by collapsing alpha
    if (i > 0) {
      const prev = tireTrail[i - 1];
      if (Math.hypot(m.x - prev.x, m.z - prev.z) > 1.2) { ttAlpha[j] = 0; ttAlpha[j + 1] = 0; }
    }
  }
  ttGeo.attributes.position.needsUpdate = true;
  (ttGeo.attributes as Record<string, THREE.BufferAttribute>).aAlpha.needsUpdate = true;
  (ttGeo.attributes as Record<string, THREE.BufferAttribute>).aDist.needsUpdate = true;
  (ttGeo.attributes as Record<string, THREE.BufferAttribute>).aSide.needsUpdate = true;
  ttGeo.setDrawRange(0, n > 1 ? (n - 1) * 6 : 0);
}

export function updateRoostParticles(dt: number, speed: number, bikeGrounded: boolean, bikePos: THREE.Vector3, curTan: THREE.Vector3, trackH: number): void {
  if (speed > 3 && bikeGrounded) {
    const roostCount = speed > 10 ? 4 : speed > 6 ? 3 : 1;
    for (let r = 0; r < roostCount && mxRoostParts.length < MX_ROOST_MAX; r++) {
      const spread = 0.15 + speed * 0.025;
      mxRoostParts.push({
        x: bikePos.x - curTan.x * 0.6 + (Math.random() - 0.5) * 0.3,
        y: trackH + 0.1,
        z: bikePos.z - curTan.z * 0.6 + (Math.random() - 0.5) * 0.3,
        vx: -curTan.x * (0.5 + speed * 0.06) + (Math.random() - 0.5) * spread,
        vy: 0.6 + Math.random() * 0.8 + speed * 0.06,
        vz: -curTan.z * (0.5 + speed * 0.06) + (Math.random() - 0.5) * spread,
        life: 0.5 + Math.random() * 0.5, ml: 0.6 + Math.random() * 0.5,
      });
    }
  }
  for (let i = mxRoostParts.length - 1; i >= 0; i--) {
    const p = mxRoostParts[i];
    p.vy -= 7 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    p.vx *= 0.97; p.vz *= 0.97; p.life -= dt;
    if (p.life <= 0 || p.y < -0.1) mxRoostParts.splice(i, 1);
  }
  const rrp = mxRoostGeo.attributes.position.array as Float32Array;
  const rrs = mxRoostGeo.attributes.size.array as Float32Array;
  for (let i = 0; i < mxRoostParts.length; i++) {
    const p = mxRoostParts[i]; rrp[i * 3] = p.x; rrp[i * 3 + 1] = p.y; rrp[i * 3 + 2] = p.z;
    rrs[i] = (p.life / p.ml) * 0.3;
  }
  mxRoostGeo.attributes.position.needsUpdate = true;
  mxRoostGeo.attributes.size.needsUpdate = true;
  mxRoostGeo.setDrawRange(0, mxRoostParts.length);
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
  for (let i = 0; i < mxAmbientParts.length; i++) {
    const p = mxAmbientParts[i]; amp[i * 3] = p.x; amp[i * 3 + 1] = p.y; amp[i * 3 + 2] = p.z;
    ams[i] = Math.min(p.life / p.ml, 1) * 0.15;
  }
  mxAmbGeo.attributes.position.needsUpdate = true;
  mxAmbGeo.attributes.size.needsUpdate = true;
  mxAmbGeo.setDrawRange(0, mxAmbientParts.length);
}
