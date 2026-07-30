import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

// ═══════════════════════════════════════════════════════════════
//  CRF450 GLB rig — rigged Honda CRF450 model used as the hero
//  bike in-game and in the garage. Attribution (CC-BY-4.0):
//  "(FREE) Honda CRF 450" by Jacobdesigns on Sketchfab.
//  The procedural bike remains as instant-load fallback.
// ═══════════════════════════════════════════════════════════════

export interface GlbBikeRig {
  root: THREE.Group;          // normalized: wheelbase 1.2, tires at y=-0.35, +z forward
  fWheel: THREE.Bone | null;  // FRONT-WHEEL-DEF — spin about local axis
  rWheel: THREE.Bone | null;  // REAR-WHEEL-ROT
  steer: THREE.Bone | null;   // FRONT-STEER
  tintMats: THREE.MeshStandardMaterial[];  // fenders/shrouds — colorway tint targets
  spin: (delta: number) => void;
}

const WHEELBASE = 1.2;
const CONTACT_Y = -0.35;

// Tintable plastic materials (colorways repaint these)
const TINT_MATS = ['FENDERS', 'SHROUDS', 'FORKGUARD', 'HONDA_RED'];
// Stripped to a flat dark finish (stock texture is Honda red)
const DARK_MATS = ['SEAT'];

let cached: GlbBikeRig | null = null;
let loading: Promise<GlbBikeRig | null> | null = null;

function findBone(root: THREE.Object3D, prefix: string): THREE.Bone | null {
  let found: THREE.Bone | null = null;
  root.traverse(o => {
    if (!found && (o as THREE.Bone).isBone && o.name.startsWith(prefix)) found = o as THREE.Bone;
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
interface PlateSpot { x: number; y: number; rot: number; size: number; maxW: number; cal: string }
// Centers measured from the source texture (PIL region analysis)
const PLATE_SPOTS: PlateSpot[] = [
  { x: 0.250, y: 0.433, rot: 0.8, size: 0.17, maxW: 0.15, cal: 'F1' },  // side plate A
  { x: 0.599, y: 0.237, rot: 0.7, size: 0.17, maxW: 0.15, cal: 'F2' },  // side plate B
  { x: 0.524, y: 0.829, rot: 0, size: 0.19, maxW: 0.24, cal: 'F3' },  // front plate
];
// Calibration mode: paint identifying digits at rot 0 to observe orientation
const PLATE_CAL = false;

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
        // preserve shading via red-channel luminance
        const l = px[i] / 230;
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
    ctx.scale(1, -1);          // plate UVs are vertically flipped on this model
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
  paintPlates(currentNum);

  const spin = makeSpin(root, fWheel, rWheel);
  return { root, fWheel, rWheel, steer, tintMats, spin };
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
  const fWheel = findBone(sceneClone, 'FRONT-WHEEL-DEF');
  const rWheel = findBone(sceneClone, 'REAR-WHEEL-ROT');
  const steer = findBone(sceneClone, 'FRONT-STEER');
  return { root, fWheel, rWheel, steer, tintMats, spin: makeSpin(root, fWheel, rWheel) };
}
