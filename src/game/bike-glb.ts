import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

// ═══════════════════════════════════════════════════════════════
//  CRF450 GLB rig — rigged Honda CRF450 model used as the hero
//  bike in-game and in the garage. Attribution (CC-BY-4.0):
//  "(FREE) Honda CRF 450" by Jacobdesigns on Sketchfab.
//  The procedural bike remains as instant-load fallback.
// ═══════════════════════════════════════════════════════════════

export type BikePartKey = 'tires' | 'engine' | 'gearbox' | 'suspension';

export interface GlbBikeRig {
  // per-part isolated materials (for garage highlight + upgrade tier tints)
  partMats: Record<BikePartKey, THREE.MeshStandardMaterial[]>;
  setPartLevel: (part: BikePartKey, level: number) => void;
  root: THREE.Group;          // normalized: wheelbase 1.2, tires at y=-0.35, +z forward
  fWheel: THREE.Bone | null;  // FRONT-WHEEL-DEF — spin about local axis
  rWheel: THREE.Bone | null;  // REAR-WHEEL-ROT
  steer: THREE.Bone | null;   // FRONT-STEER
  tintMats: THREE.MeshStandardMaterial[];  // fenders/shrouds — colorway tint targets
  spin: (delta: number) => void;
  // rider attach points baked into the CRF rig
  mounts: { handL: THREE.Bone | null; handR: THREE.Bone | null; footL: THREE.Bone | null; footR: THREE.Bone | null; seat: THREE.Bone | null };
}

const WHEELBASE = 1.2;
const CONTACT_Y = -0.35;

// Garage part groups — matched on mesh/node names (GLB built with --join
// false). ORDER MATTERS: first match wins (rear sprocket lives inside the
// REAR RIM mesh; fork hub carries a RIMS primitive).
const PART_MATCH: [BikePartKey, RegExp][] = [
  ['gearbox', /FRONT SPROCKET|REAR RIM_FORK/i],                 // gearing: both sprockets
  ['suspension', /FORK LOWERS|FORK UPPERS|Circle\.002|Circle\.014|Cylinder\.002/i], // forks + rear shock/spring
  ['engine', /MOTOR|EXHAUST|RADIATOR|BASH/i],
  ['tires', /TIRE|RIM/i],
];
// colorway-owned plastics never take part tints/highlights
const PART_EXCLUDE_MAT = /FENDERS|SHROUDS|FORKGUARD|HONDA|SEAT|NUMBERPLATES/i;
// upgrade tier finishes: stock, bronze, silver, gold
const TIER_TINT = [null, 0xa8703e, 0xc4cbd4, 0xe3b74a] as const;

interface PartSystem {
  partMats: Record<BikePartKey, THREE.MeshStandardMaterial[]>;
  setPartLevel: (part: BikePartKey, level: number) => void;
}

// Give every part-matched mesh its own material clone (so tint/highlight
// can't leak to shared materials), remember stock colors, expose tiers.
function buildPartSystem(scene: THREE.Object3D): PartSystem {
  const partMats: Record<BikePartKey, THREE.MeshStandardMaterial[]> = { tires: [], engine: [], gearbox: [], suspension: [] };
  const stock = new Map<THREE.MeshStandardMaterial, THREE.Color>();
  scene.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const name = (m.name || '') + '/' + (m.parent?.name || '');
    for (const [key, re] of PART_MATCH) {
      if (!re.test(name)) continue;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const cloned = mats.map(mat => {
        const sm = mat as THREE.MeshStandardMaterial;
        if (PART_EXCLUDE_MAT.test(sm.name || '')) return sm;   // colorway plastic stays shared
        const c = sm.clone();
        stock.set(c, c.color.clone());
        partMats[key].push(c);
        return c;
      });
      m.material = Array.isArray(m.material) ? cloned : cloned[0];
      break;
    }
  });
  const setPartLevel = (part: BikePartKey, level: number): void => {
    const tint = TIER_TINT[Math.max(0, Math.min(3, level))];
    for (const mat of partMats[part]) {
      const base = stock.get(mat)!;
      if (tint === null) {
        mat.color.copy(base);
        mat.metalness = Math.min(1, mat.metalness);
      } else {
        mat.color.copy(base).lerp(new THREE.Color(tint), 0.55);
        mat.metalness = Math.min(1, mat.metalness + 0.25);
        mat.roughness = Math.max(0.15, mat.roughness - 0.2);
      }
    }
  };
  return { partMats, setPartLevel };
}

// Tintable plastic materials (colorways repaint these)
const TINT_MATS = ['FENDERS', 'SHROUDS', 'FORKGUARD', 'HONDA_RED'];
// Stripped to a flat dark finish (stock texture is Honda red)
const DARK_MATS = ['SEAT'];

let cached: GlbBikeRig | null = null;
let loading: Promise<GlbBikeRig | null> | null = null;

// GLTFLoader sanitizes node names (dots/spaces stripped), so match on a
// normalized form: alphanumerics only, uppercase.
const normName = (n: string) => n.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

function findBone(root: THREE.Object3D, prefix: string): THREE.Bone | null {
  const want = normName(prefix);
  let found: THREE.Bone | null = null;
  root.traverse(o => {
    if (!found && (o as THREE.Bone).isBone && normName(o.name).startsWith(want)) found = o as THREE.Bone;
  });
  return found;
}

// De-badge: strip the baked graphics kit (BACKYARD logos, swooshes) from a
// plastic material entirely — flat white base, colorway tint paints it.
function stripGraphics(mat: THREE.MeshStandardMaterial): void {
  mat.map = null;
  mat.needsUpdate = true;
}

// ── Number plates: repaint the NUMBERPLATES texture with the rider number ──
// UV regions measured from the source texture (three white plate zones; the
// front plate is mapped upside-down and carried a logo band — blacked out).
// frame: texture-space basis derived from the mesh geometry so text renders
// level and unmirrored on the 3D plate regardless of UV rotation/shear.
// (ax,ay) = texture direction of on-plate "reading left→right",
// (bx,by) = texture direction of on-plate "down".
interface PlateFrame { ax: number; ay: number; bx: number; by: number }
interface PlateSpot {
  x: number; y: number; rot: number; size: number; maxW: number; cal: string;
  region: [number, number, number, number];   // minU, maxU, minV, maxV
  readDir: [number, number, number];          // world reading direction on the plate
  frame?: PlateFrame;                         // computed at load
}
const PLATE_SPOTS: PlateSpot[] = [
  { x: 0.242, y: 0.441, rot: 1.83, size: 0.26, maxW: 0.19, cal: 'F1',
    region: [0.10, 0.38, 0.22, 0.66], readDir: [0, 0, 1] },   // left side plate (viewed from -x)
  { x: 0.593, y: 0.245, rot: -1.83, size: 0.26, maxW: 0.19, cal: 'F2',
    region: [0.44, 0.70, 0.02, 0.42], readDir: [0, 0, -1] },  // right side plate (viewed from +x)
  { x: 0.524, y: 0.835, rot: 0, size: 0.21, maxW: 0.24, cal: 'F3',
    region: [0.34, 0.68, 0.62, 1.0], readDir: [-1, 0, 0] },   // front plate (viewed from +z)
];
// Calibration mode: paint identifying digits to observe orientation
const PLATE_CAL = false;

// Derive each plate's texture-space frame from the actual mesh: find a
// triangle whose UVs sit inside the plate region, build the Jacobian
// world = J · uv, then express the desired world "reading" and "down"
// directions back in texture space (least squares through JᵀJ).
function computePlateFrames(scene: THREE.Object3D): void {
  let mesh: THREE.Mesh | null = null;
  scene.traverse(o => {
    const m = o as THREE.Mesh;
    if (mesh || !m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    if (mats.some(mm => (mm as THREE.Material).name?.toUpperCase().includes('NUMBERPLATES'))) mesh = m;
  });
  if (!mesh) return;
  const g = (mesh as THREE.Mesh).geometry;
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  const idx = g.getIndex();
  if (!pos || !uv) return;
  (mesh as THREE.Mesh).updateWorldMatrix(true, false);
  const mw = (mesh as THREE.Mesh).matrixWorld;
  const triCount = idx ? idx.count / 3 : pos.count / 3;
  const vi = (t: number, k: number) => idx ? idx.getX(t * 3 + k) : t * 3 + k;
  const wp = (i: number) => new THREE.Vector3().fromBufferAttribute(pos as THREE.BufferAttribute, i).applyMatrix4(mw);

  for (const spot of PLATE_SPOTS) {
    const [u0, u1, v0, v1] = spot.region;
    let best: { area: number; frame: PlateFrame } | null = null;
    for (let t = 0; t < triCount; t++) {
      const ia = vi(t, 0), ib = vi(t, 1), ic = vi(t, 2);
      const uva = [uv.getX(ia), uv.getY(ia)] as const;
      const uvb = [uv.getX(ib), uv.getY(ib)] as const;
      const uvc = [uv.getX(ic), uv.getY(ic)] as const;
      const inR = (q: readonly [number, number]) => q[0] >= u0 && q[0] <= u1 && q[1] >= v0 && q[1] <= v1;
      if (!inR(uva) || !inR(uvb) || !inR(uvc)) continue;
      // uv deltas (2x2) and world deltas (3x2)
      const du1 = uvb[0] - uva[0], dv1 = uvb[1] - uva[1];
      const du2 = uvc[0] - uva[0], dv2 = uvc[1] - uva[1];
      const det = du1 * dv2 - du2 * dv1;
      if (Math.abs(det) < 1e-8) continue;
      const A = wp(ia), B = wp(ib), C = wp(ic);
      const e1 = new THREE.Vector3().subVectors(B, A);
      const e2 = new THREE.Vector3().subVectors(C, A);
      // J columns: dWorld/du, dWorld/dv
      const Ju = new THREE.Vector3().addScaledVector(e1, dv2 / det).addScaledVector(e2, -dv1 / det);
      const Jv = new THREE.Vector3().addScaledVector(e1, -du2 / det).addScaledVector(e2, du1 / det);
      // least squares: uvDir = (JtJ)^-1 Jt · worldDir
      const a11 = Ju.dot(Ju), a12 = Ju.dot(Jv), a22 = Jv.dot(Jv);
      const dJ = a11 * a22 - a12 * a12;
      if (Math.abs(dJ) < 1e-12) continue;
      const solve = (w: THREE.Vector3): [number, number] => {
        const b1 = Ju.dot(w), b2 = Jv.dot(w);
        return [(a22 * b1 - a12 * b2) / dJ, (a11 * b2 - a12 * b1) / dJ];
      };
      const read = solve(new THREE.Vector3(...spot.readDir));
      const down = solve(new THREE.Vector3(0, -1, 0));
      const nrm = (q: [number, number]): [number, number] => {
        const l = Math.hypot(q[0], q[1]) || 1;
        return [q[0] / l, q[1] / l];
      };
      const [ax, ay] = nrm(read);
      const [bx, by] = nrm(down);
      const area = Math.abs(det);
      if (!best || area > best.area) best = { area, frame: { ax, ay, bx, by } };
    }
    if (best) spot.frame = best.frame;
  }
}

const plateMats: THREE.MeshStandardMaterial[] = [];
let plateSourceImg: CanvasImageSource | null = null;
let currentNum = 7;
let plateTint: THREE.Color | null = null;

function paintPlates(num: number): void {
  if (!plateSourceImg) return;
  const S = 1024;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d')!;
  ctx.drawImage(plateSourceImg, 0, 0, S, S);
  // Recolor the red background (side panels / plate surrounds) to the
  // current colorway so the whole bike follows the garage color.
  if (plateTint) {
    const d = ctx.getImageData(0, 0, S, S);
    const px = d.data;
    const tr = Math.round(plateTint.r * 255), tg = Math.round(plateTint.g * 255), tb = Math.round(plateTint.b * 255);
    for (let i = 0; i < px.length; i += 4) {
      if (px[i] > 140 && px[i + 1] < 90 && px[i + 2] < 90) {
        // near-flat tint so panels match the untextured plastics exactly
        const l = Math.min(1, 0.92 + (px[i] / 255) * 0.1);
        px[i] = Math.min(255, tr * l); px[i + 1] = Math.min(255, tg * l); px[i + 2] = Math.min(255, tb * l);
      }
    }
    ctx.putImageData(d, 0, 0);
  }
  // cover the logo lettering on the front plate band (band itself is black)
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(S * 0.545, S * 0.90, S * 0.125, S * 0.062);
  // draw the number on each plate
  const numTxt = String(Math.max(0, Math.min(999, Math.round(num))));
  for (const p of PLATE_SPOTS) {
    const txt = PLATE_CAL ? p.cal : numTxt;
    ctx.save();
    ctx.translate(p.x * S, p.y * S);
    if (p.frame) {
      // geometry-derived basis: canvas x → on-plate reading dir, canvas y → on-plate down
      ctx.transform(-p.frame.ax, -p.frame.ay, -p.frame.bx, -p.frame.by, 0, 0);
    }
    ctx.rotate(p.rot);
    ctx.fillStyle = '#111';
    // fit: shrink font until the number fits the plate width
    let px = Math.round(p.size * S);
    ctx.font = `700 ${px}px 'Archivo Black', 'Arial Black', sans-serif`;
    const w = ctx.measureText(txt).width;
    if (w > p.maxW * S) {
      px = Math.floor(px * (p.maxW * S) / w);
      ctx.font = `700 ${px}px 'Archivo Black', 'Arial Black', sans-serif`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, 0, 0);
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;
  for (const m of plateMats) {
    m.map = tex;
    m.needsUpdate = true;
  }
}

export function setRiderNumber(num: number): void {
  currentNum = num;
  paintPlates(num);
}

export function setPlateTint(c: THREE.Color): void {
  plateTint = c.clone();
  paintPlates(currentNum);
}

export function getRiderNumber(): number { return currentNum; }

// Dev-only: live plate calibration from debug-bike.html
export function tunePlate(i: number, patch: Partial<PlateSpot>): void {
  Object.assign(PLATE_SPOTS[i], patch);
  paintPlates(currentNum);
}

export function getPlateSpots(): PlateSpot[] {
  return PLATE_SPOTS.map(p => ({ ...p }));
}

function buildRig(scene: THREE.Group): GlbBikeRig {
  const root = new THREE.Group();
  root.add(scene);

  scene.traverse(o => {
    const m = o as THREE.Mesh;
    if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; }
  });

  const fWheel = findBone(scene, 'FRONT-WHEEL-DEF');
  const rWheel = findBone(scene, 'REAR-WHEEL-ROT');
  const steer = findBone(scene, 'FRONT-STEER');

  // ── Normalize: measure wheel bone span for wheelbase, bbox for ground ──
  scene.updateMatrixWorld(true);
  const fPos = new THREE.Vector3(), rPos = new THREE.Vector3();
  if (fWheel && rWheel) {
    fWheel.getWorldPosition(fPos);
    rWheel.getWorldPosition(rPos);
  }
  const span = fPos.distanceTo(rPos) || 1;
  const scale = WHEELBASE / span;
  scene.scale.setScalar(scale);
  scene.updateMatrixWorld(true);

  // Orient: +z must be forward (front wheel toward +z), then re-measure
  fWheel?.getWorldPosition(fPos); rWheel?.getWorldPosition(rPos);
  const fwd = new THREE.Vector3().subVectors(fPos, rPos);
  const yaw = Math.atan2(fwd.x, fwd.z);
  scene.rotation.y = -yaw;
  scene.updateMatrixWorld(true);

  // Ground + centering: tires rest on CONTACT_Y, axle midpoint on x=0/z centered
  const bb = new THREE.Box3().setFromObject(scene);
  fWheel?.getWorldPosition(fPos); rWheel?.getWorldPosition(rPos);
  const midZ = (fPos.z + rPos.z) / 2;
  const midX = (fPos.x + rPos.x) / 2;
  scene.position.set(-midX, CONTACT_Y - bb.min.y, -midZ);

  // ── Collect tint materials, strip graphics kits, hook up number plates ──
  const tintMats: THREE.MeshStandardMaterial[] = [];
  const seen = new Set<string>();
  scene.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      const sm = mat as THREE.MeshStandardMaterial;
      if (seen.has(sm.uuid)) continue;
      const name = sm.name?.toUpperCase() || '';
      if (TINT_MATS.some(n => name.replace(/ /g, '_').includes(n))) {
        seen.add(sm.uuid);
        stripGraphics(sm);
        tintMats.push(sm);
      } else if (DARK_MATS.some(n => name.includes(n))) {
        seen.add(sm.uuid);
        stripGraphics(sm);
        sm.color.set(0x26262a);
      } else if (name.includes('NUMBERPLATES')) {
        seen.add(sm.uuid);
        if (!plateSourceImg && sm.map?.image) plateSourceImg = sm.map.image as CanvasImageSource;
        plateMats.push(sm);
      }
    }
  });
  computePlateFrames(scene);
  paintPlates(currentNum);

  const spin = makeSpin(root, fWheel, rWheel);
  const parts = buildPartSystem(scene);
  const mounts = {
    handL: findBone(scene, 'HAND-SNAP.L'),
    handR: findBone(scene, 'HAND-SNAP.R'),
    footL: findBone(scene, 'FOOT-ATCH.L'),
    footR: findBone(scene, 'FOOT-ATCH.R'),
    seat: findBone(scene, 'RIDER-ATTATCH'),
  };
  return { root, fWheel, rWheel, steer, tintMats, spin, mounts, partMats: parts.partMats, setPartLevel: parts.setPartLevel };
}

// The FBX rig's wheel bones have arbitrary rest orientations (the front one
// carries the steering rake), so a naive rotation.x spins the front wheel
// sideways. Instead: express the bike's axle direction (world X of the
// normalized root) in each bone's local frame once, then spin about that
// axis — it stays invariant under its own rotation.
function makeSpin(root: THREE.Object3D, fWheel: THREE.Bone | null, rWheel: THREE.Bone | null): (d: number) => void {
  root.updateMatrixWorld(true);
  const axleFor = (bone: THREE.Bone | null): THREE.Vector3 | null => {
    if (!bone) return null;
    const q = bone.getWorldQuaternion(new THREE.Quaternion()).invert();
    // axle = world X in the root's frame (root is axis-aligned after normalize)
    const rootQ = root.getWorldQuaternion(new THREE.Quaternion());
    const axleWorld = new THREE.Vector3(1, 0, 0).applyQuaternion(rootQ);
    return axleWorld.applyQuaternion(q).normalize();
  };
  const fAxis = axleFor(fWheel);
  const rAxis = axleFor(rWheel);
  return (delta: number) => {
    if (fWheel && fAxis) fWheel.rotateOnAxis(fAxis, delta);
    if (rWheel && rAxis) rWheel.rotateOnAxis(rAxis, delta);
  };
}

export function loadGlbBike(): Promise<GlbBikeRig | null> {
  if (cached) return Promise.resolve(cached);
  if (loading) return loading;
  loading = new Promise((resolve) => {
    new GLTFLoader().load(
      '/models/crf450.glb',
      (gltf) => {
        try {
          cached = buildRig(gltf.scene as unknown as THREE.Group);
          resolve(cached);
        } catch (e) {
          console.warn('[bike-glb] rig build failed, using procedural bike', e);
          resolve(null);
        }
      },
      undefined,
      (err) => {
        console.warn('[bike-glb] load failed, using procedural bike', err);
        resolve(null);
      },
    );
  });
  return loading;
}

// Garage preview needs an independent copy (separate scene)
export function cloneGlbBike(): GlbBikeRig | null {
  if (!cached) return null;
  const sceneClone = SkeletonUtils.clone(cached.root.children[0]) as THREE.Group;
  // cloned materials are shared — clone tintables so preview tints don't leak
  const tintMats: THREE.MeshStandardMaterial[] = [];
  const remap = new Map<string, THREE.MeshStandardMaterial>();
  sceneClone.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const newMats = mats.map(mat => {
      const sm = mat as THREE.MeshStandardMaterial;
      if (TINT_MATS.some(n => sm.name?.toUpperCase().includes(n))) {
        if (!remap.has(sm.uuid)) {
          const c = sm.clone();
          remap.set(sm.uuid, c);
          tintMats.push(c);
        }
        return remap.get(sm.uuid)!;
      }
      return sm;
    });
    m.material = Array.isArray(m.material) ? newMats : newMats[0];
  });
  const root = new THREE.Group();
  root.add(sceneClone);
  const partsC = buildPartSystem(sceneClone);
  const fWheel = findBone(sceneClone, 'FRONT-WHEEL-DEF');
  const rWheel = findBone(sceneClone, 'REAR-WHEEL-ROT');
  const steer = findBone(sceneClone, 'FRONT-STEER');
  return {
    root, fWheel, rWheel, steer, tintMats, spin: makeSpin(root, fWheel, rWheel),
    partMats: partsC.partMats, setPartLevel: partsC.setPartLevel,
    mounts: {
      handL: findBone(sceneClone, 'HAND-SNAP.L'),
      handR: findBone(sceneClone, 'HAND-SNAP.R'),
      footL: findBone(sceneClone, 'FOOT-ATCH.L'),
      footR: findBone(sceneClone, 'FOOT-ATCH.R'),
      seat: findBone(sceneClone, 'RIDER-ATTATCH'),
    },
  };
}
