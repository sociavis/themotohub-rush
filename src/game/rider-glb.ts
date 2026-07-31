import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { url } from './base-url';

// ═══════════════════════════════════════════════════════════════
//  GLB rider — "Low-poly Motocross Character (rigged)" by XHeheX
//  on Sketchfab (CC-BY-4.0). Standard Mixamo skeleton.
//
//  Limbs are posed with analytic two-bone IK aimed at the bike's
//  own attach bones (HAND-SNAP.L/R, FOOT-ATCH.L/R), so hands stay
//  on the grips and boots on the pegs regardless of the model's
//  rest-pose axis conventions. Torso/head use small manual deltas.
// ═══════════════════════════════════════════════════════════════

export interface RiderPose {
  crouch: number;   // 0 = seated, 1 = standing attack position
  back: number;     // 0..1 weight shifted back (wheelie)
  legOut: number;   // -1 left leg out, 0 none, 1 right leg out
  tuck: number;     // 0..1 in-air tuck
  lean: number;     // -1..1 lateral lean into corners
}

export interface MountPoints {
  handL: THREE.Object3D | null; handR: THREE.Object3D | null;
  footL: THREE.Object3D | null; footR: THREE.Object3D | null;
}

export interface RiderRig {
  root: THREE.Group;
  attach: (mounts: MountPoints) => void;
  update: (pose: RiderPose, dt: number) => void;
  setJerseyColor: (c: THREE.Color) => void;
  setHeight: (h: number) => void;
  setBodyShape: (shape: { legLen?: number; armLen?: number; footSize?: number }) => void;
}

// Rider height in game units (bike wheelbase 1.2 ≈ 1.48 m → 1.6 m rider ≈ 1.3)
const RIDER_HEIGHT = 1.1;

// Live-tunable fit offsets (rider calibration in debug-bike.html)
export const RIDER_TUNE = { footUp: 0.16, footOut: 0.105, handUp: 0.06, handOut: 0.035 };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

interface Bones {
  hips: THREE.Bone; spine: THREE.Bone; spine1: THREE.Bone; spine2: THREE.Bone;
  neck: THREE.Bone; head: THREE.Bone;
  lArm: THREE.Bone; lForeArm: THREE.Bone; lHand: THREE.Bone;
  rArm: THREE.Bone; rForeArm: THREE.Bone; rHand: THREE.Bone;
  lUpLeg: THREE.Bone; lLeg: THREE.Bone; lFoot: THREE.Bone;
  rUpLeg: THREE.Bone; rLeg: THREE.Bone; rFoot: THREE.Bone;
}

function findBones(root: THREE.Object3D): Bones | null {
  const get = (frag: string): THREE.Bone | null => {
    let found: THREE.Bone | null = null;
    root.traverse(o => {
      if (!found && (o as THREE.Bone).isBone && o.name.includes(frag)) found = o as THREE.Bone;
    });
    return found;
  };
  const b = {
    hips: get('Hips'), spine: get('Spine_'), spine1: get('Spine1'), spine2: get('Spine2'),
    neck: get('Neck'), head: get('Head_'),
    lArm: get('LeftArm'), lForeArm: get('LeftForeArm'), lHand: get('LeftHand_'),
    rArm: get('RightArm'), rForeArm: get('RightForeArm'), rHand: get('RightHand_'),
    lUpLeg: get('LeftUpLeg'), lLeg: get('LeftLeg'), lFoot: get('LeftFoot'),
    rUpLeg: get('RightUpLeg'), rLeg: get('RightLeg'), rFoot: get('RightFoot'),
  };
  for (const k of Object.keys(b)) if (!(b as Record<string, unknown>)[k]) return null;
  return b as Bones;
}

// ── Aim a bone so the direction to its child points at targetWorld ──
// Rest-axis agnostic: rotates the bone's CURRENT child direction onto the
// desired direction in world space.
function aimBone(bone: THREE.Bone, childLocalDir: THREE.Vector3, targetWorld: THREE.Vector3): void {
  const bonePos = bone.getWorldPosition(new THREE.Vector3());
  const parentQuat = bone.parent!.getWorldQuaternion(new THREE.Quaternion());
  const boneWorldQuat = parentQuat.clone().multiply(bone.quaternion);
  const curWorldDir = childLocalDir.clone().applyQuaternion(boneWorldQuat).normalize();
  const wantDir = targetWorld.clone().sub(bonePos).normalize();
  const delta = new THREE.Quaternion().setFromUnitVectors(curWorldDir, wantDir);
  const newWorld = delta.multiply(boneWorldQuat);
  bone.quaternion.copy(parentQuat.invert().multiply(newWorld));
  bone.updateMatrixWorld(true);
}

interface Limb {
  upper: THREE.Bone; lower: THREE.Bone; end: THREE.Bone;
  upperDir: THREE.Vector3;   // rest-pose local dir upper→lower
  lowerDir: THREE.Vector3;   // rest-pose local dir lower→end
  upperRest: THREE.Quaternion; lowerRest: THREE.Quaternion;
  l1: number; l2: number;
}

function makeLimb(upper: THREE.Bone, lower: THREE.Bone, end: THREE.Bone): Limb {
  const up = upper.getWorldPosition(new THREE.Vector3());
  const lp = lower.getWorldPosition(new THREE.Vector3());
  const ep = end.getWorldPosition(new THREE.Vector3());
  const upperWorldQuat = upper.getWorldQuaternion(new THREE.Quaternion());
  const lowerWorldQuat = lower.getWorldQuaternion(new THREE.Quaternion());
  return {
    upper, lower, end,
    upperDir: lp.clone().sub(up).applyQuaternion(upperWorldQuat.clone().invert()).normalize(),
    lowerDir: ep.clone().sub(lp).applyQuaternion(lowerWorldQuat.clone().invert()).normalize(),
    upperRest: upper.quaternion.clone(), lowerRest: lower.quaternion.clone(),
    l1: up.distanceTo(lp), l2: lp.distanceTo(ep),
  };
}

// Two-bone IK: place `end` at target with the joint bending toward poleHint.
function solveLimb(limb: Limb, targetWorld: THREE.Vector3, poleHintWorld: THREE.Vector3): void {
  // start from rest pose so repeated solves don't accumulate twist
  limb.upper.quaternion.copy(limb.upperRest);
  limb.lower.quaternion.copy(limb.lowerRest);
  limb.upper.updateMatrixWorld(true);

  const rootPos = limb.upper.getWorldPosition(new THREE.Vector3());
  const toTarget = targetWorld.clone().sub(rootPos);
  const d = Math.min(Math.max(toTarget.length(), 0.01), limb.l1 + limb.l2 - 0.005);
  const chainDir = toTarget.normalize();
  const cosA = (limb.l1 * limb.l1 + d * d - limb.l2 * limb.l2) / (2 * limb.l1 * d);
  const a = Math.acos(Math.min(1, Math.max(-1, cosA)));
  const poleDir = poleHintWorld.clone().sub(rootPos);
  poleDir.sub(chainDir.clone().multiplyScalar(poleDir.dot(chainDir)));
  if (poleDir.lengthSq() < 1e-8) poleDir.set(0, 0, 1);
  poleDir.normalize();
  const jointPos = rootPos.clone()
    .add(chainDir.clone().multiplyScalar(Math.cos(a) * limb.l1))
    .add(poleDir.clone().multiplyScalar(Math.sin(a) * limb.l1));
  aimBone(limb.upper, limb.upperDir, jointPos);
  aimBone(limb.lower, limb.lowerDir, targetWorld);
}

let cached: RiderRig | null = null;
let loading: Promise<RiderRig | null> | null = null;
let nanWarned = false;

function buildRig(scene: THREE.Group): RiderRig | null {
  const root = new THREE.Group();
  root.name = 'rider';
  root.add(scene);

  scene.traverse(o => {
    const m = o as THREE.Mesh;
    if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; }
  });

  const bonesN = findBones(scene);
  if (!bonesN) {
    console.warn('[rider-glb] mixamo bones not found');
    return null;
  }
  const bones: Bones = bonesN;

  // ── Normalize via skeleton (skinned bboxes lie about size) ──
  scene.updateMatrixWorld(true);
  const headW = bones.head.getWorldPosition(new THREE.Vector3());
  const footW = bones.lFoot.getWorldPosition(new THREE.Vector3());
  const h = Math.abs(headW.y - footW.y) * 1.15 || 1;
  scene.scale.setScalar(scene.scale.x * (RIDER_HEIGHT / h));
  scene.updateMatrixWorld(true);
  // anchor hips at the rider-root origin (mount point = seat)
  const hipsW = bones.hips.getWorldPosition(new THREE.Vector3());
  scene.position.sub(hipsW);
  scene.updateMatrixWorld(true);
  const anchor = scene.position.clone();

  // torso rest quats
  const torsoBones = [bones.hips, bones.spine, bones.spine1, bones.spine2, bones.neck, bones.head];
  const rest = new Map<THREE.Bone, THREE.Quaternion>();
  for (const b of torsoBones) rest.set(b, b.quaternion.clone());

  // limbs measured in normalized bind pose
  const restAll = new Map<THREE.Bone, THREE.Quaternion>();
  for (const b of Object.values(bones)) restAll.set(b as THREE.Bone, (b as THREE.Bone).quaternion.clone());
  let curHeight = RIDER_HEIGHT;
  let armL = makeLimb(bones.lArm, bones.lForeArm, bones.lHand);
  let armR = makeLimb(bones.rArm, bones.rForeArm, bones.rHand);
  let legL = makeLimb(bones.lUpLeg, bones.lLeg, bones.lFoot);
  let legR = makeLimb(bones.rUpLeg, bones.rLeg, bones.rFoot);

  let mounts: MountPoints | null = null;

  const cur = { crouch: 0, back: 0, tuck: 0, legOutL: 0, legOutR: 0, lean: 0 };
  const eul = new THREE.Euler();
  const dq = new THREE.Quaternion();

  function setTorso(): void {
    const c = cur.crouch, b = cur.back, tk = cur.tuck;
    const spineX = lerp(lerp(0.32, 0.5, c), -0.15, b) + tk * 0.15;
    const set = (bone: THREE.Bone, x: number, y: number, z: number) => {
      eul.set(x, y, z);
      dq.setFromEuler(eul);
      bone.quaternion.copy(rest.get(bone)!).multiply(dq);
    };
    set(bones.hips, lerp(lerp(0.12, 0.28, c), -0.08, b), 0, cur.lean * 0.06);
    set(bones.spine, spineX * 0.45, 0, cur.lean * 0.05);
    set(bones.spine1, spineX * 0.35, 0, cur.lean * 0.04);
    set(bones.spine2, spineX * 0.3, 0, cur.lean * 0.03);
    set(bones.neck, -spineX * 0.5, 0, 0);
    set(bones.head, -spineX * 0.45, -cur.lean * 0.15, 0);
    // rise in attack, slide back on wheelie
    scene.position.set(anchor.x, anchor.y + cur.crouch * 0.07 - cur.tuck * 0.03,
      anchor.z - cur.back * 0.1 - cur.crouch * 0.05);
  }

  function update(pose: RiderPose, dt: number): void {
    lastPose = pose;
    const sm = Math.min(1, dt * 9);
    cur.crouch = lerp(cur.crouch, pose.crouch, sm);
    cur.back = lerp(cur.back, pose.back, sm);
    cur.tuck = lerp(cur.tuck, pose.tuck, sm);
    cur.lean = lerp(cur.lean, pose.lean, sm);
    cur.legOutL = lerp(cur.legOutL, pose.legOut > 0 ? 1 : 0, sm * 0.8);
    cur.legOutR = lerp(cur.legOutR, pose.legOut < 0 ? 1 : 0, sm * 0.8);

    setTorso();
    root.updateMatrixWorld(true);
    if (!mounts || !mounts.handL) return;

    const rootW = root.getWorldPosition(new THREE.Vector3());
    const rootQ = root.getWorldQuaternion(new THREE.Quaternion());
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(rootQ);
    const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), fwd);

    // Feet on pegs (leg-out swings the boot forward and out, MX style)
    const footLT = mounts.footL!.getWorldPosition(new THREE.Vector3());
    const footRT = mounts.footR!.getWorldPosition(new THREE.Vector3());
    footLT.add(side.clone().multiplyScalar(RIDER_TUNE.footOut));
    footRT.add(side.clone().multiplyScalar(-RIDER_TUNE.footOut));
    footLT.y += RIDER_TUNE.footUp;
    footRT.y += RIDER_TUNE.footUp;
    if (cur.legOutL > 0.02) footLT.add(fwd.clone().multiplyScalar(cur.legOutL * 0.55)).add(side.clone().multiplyScalar(cur.legOutL * 0.25)).add(new THREE.Vector3(0, cur.legOutL * 0.1, 0));
    if (cur.legOutR > 0.02) footRT.add(fwd.clone().multiplyScalar(cur.legOutR * 0.55)).add(side.clone().multiplyScalar(-cur.legOutR * 0.25)).add(new THREE.Vector3(0, cur.legOutR * 0.1, 0));
    // knees bend forward, slightly out — pole kept tight so shins hug the bike
    solveLimb(legL, footLT, rootW.clone().add(fwd.clone().multiplyScalar(0.45)).add(side.clone().multiplyScalar(0.35)));
    solveLimb(legR, footRT, rootW.clone().add(fwd.clone().multiplyScalar(0.45)).add(side.clone().multiplyScalar(-0.35)));

    // Hands on grips — elbows out and up (attack style)
    const handLT = mounts.handL!.getWorldPosition(new THREE.Vector3());
    const handRT = mounts.handR!.getWorldPosition(new THREE.Vector3());
    handLT.y += RIDER_TUNE.handUp;
    handRT.y += RIDER_TUNE.handUp;
    handLT.add(side.clone().multiplyScalar(RIDER_TUNE.handOut));
    handRT.add(side.clone().multiplyScalar(-RIDER_TUNE.handOut));
    const elbowUp = 0.32 + cur.crouch * 0.2;
    solveLimb(armL, handLT, rootW.clone().add(side.clone().multiplyScalar(0.9)).add(new THREE.Vector3(0, elbowUp, 0)));
    solveLimb(armR, handRT, rootW.clone().add(side.clone().multiplyScalar(-0.9)).add(new THREE.Vector3(0, elbowUp, 0)));

    // NaN tripwire (dev): a poisoned quaternion melts the skinned mesh + GPU
    if (!nanWarned) {
      for (const lb of [armL, armR, legL, legR]) {
        const q = lb.upper.quaternion;
        if (Number.isNaN(q.x + q.y + q.z + q.w)) {
          nanWarned = true;
          console.error('[rider-glb] NaN in bone quaternion:', lb.upper.name);
          break;
        }
      }
    }
  }

  let lastPose: RiderPose = { crouch: 0, back: 0, legOut: 0, tuck: 0, lean: 0 };
  const attach = (m: MountPoints): void => {
    mounts = m;
    update(lastPose, 1);
  };

  // Restore bind pose → re-measure IK limbs → re-solve. Used by both the
  // height rescale and body-shape changes.
  const remeasure = (): void => {
    for (const [b, q] of restAll) b.quaternion.copy(q);
    scene.updateMatrixWorld(true);
    armL = makeLimb(bones.lArm, bones.lForeArm, bones.lHand);
    armR = makeLimb(bones.rArm, bones.rForeArm, bones.rHand);
    legL = makeLimb(bones.lUpLeg, bones.lLeg, bones.lFoot);
    legR = makeLimb(bones.rUpLeg, bones.rLeg, bones.rFoot);
    update(lastPose, 1);
  };

  const setHeight = (h: number): void => {
    scene.scale.multiplyScalar(h / curHeight);
    curHeight = h;
    remeasure();
  };

  // Body proportions: bone scales cascade down the chain, so children get
  // inverse-compensated (legs carry the feet, arms carry the hands).
  const shape = { legLen: 0.92, armLen: 0.95, footSize: 0.91 };
  const setBodyShape = (p: { legLen?: number; armLen?: number; footSize?: number }): void => {
    Object.assign(shape, p);
    bones.lUpLeg.scale.setScalar(shape.legLen);
    bones.rUpLeg.scale.setScalar(shape.legLen);
    bones.lFoot.scale.setScalar(shape.footSize / shape.legLen);
    bones.rFoot.scale.setScalar(shape.footSize / shape.legLen);
    bones.lArm.scale.setScalar(shape.armLen);
    bones.rArm.scale.setScalar(shape.armLen);
    bones.lHand.scale.setScalar(1 / shape.armLen);
    bones.rHand.scale.setScalar(1 / shape.armLen);
    remeasure();
  };

  const setJerseyColor = (c: THREE.Color): void => {
    scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        const sm = mat as THREE.MeshStandardMaterial;
        if (!sm.color) continue;
        const hsl = { h: 0, s: 0, l: 0 };
        sm.color.getHSL(hsl);
        if (hsl.s > 0.35 && hsl.l > 0.15) sm.color.copy(c);
      }
    });
  };

  // apply the calibrated proportions to the bind pose before first solve
  setBodyShape({});

  return { root, attach, update, setJerseyColor, setHeight, setBodyShape };
}

export function loadGlbRider(): Promise<RiderRig | null> {
  if (cached) return Promise.resolve(cached);
  if (loading) return loading;
  loading = new Promise((resolve) => {
    new GLTFLoader().load(
      url('models/rider.glb'),
      (gltf) => {
        try {
          cached = buildRig(gltf.scene as unknown as THREE.Group);
          resolve(cached);
        } catch (e) {
          console.warn('[rider-glb] rig build failed', e);
          resolve(null);
        }
      },
      undefined,
      (err) => { console.warn('[rider-glb] load failed', err); resolve(null); },
    );
  });
  return loading;
}
