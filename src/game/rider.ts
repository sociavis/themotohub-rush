import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════
//  PROCEDURAL MX RIDER — articulated low-poly figure that sits on
//  the bike and animates between poses: seated, attack (standing),
//  wheelie (weight back) and cornering leg-out.
// ═══════════════════════════════════════════════════════════════

export interface RiderPose {
  crouch: number;   // 0 = seated, 1 = standing attack position
  back: number;     // 0..1 weight shifted back (wheelie)
  legOut: number;   // -1 left leg out, 0 none, 1 right leg out
  tuck: number;     // 0..1 in-air tuck
}

export interface RiderRig {
  group: THREE.Group;
  setJerseyColor: (c: THREE.Color) => void;
  update: (pose: RiderPose, dt: number) => void;
}

function box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  return m;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function createRider(jersey: THREE.Color | number = 0xff5a0a): RiderRig {
  const group = new THREE.Group();
  // root sits above the seat
  group.position.set(0, 0.385, -0.1);

  const jerseyMat = new THREE.MeshStandardMaterial({ color: jersey, roughness: 0.75, metalness: 0 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x26262b, roughness: 0.8, metalness: 0 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0x1f1f22, roughness: 0.85, metalness: 0 }); // gloved/geared
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: 0.6, metalness: 0.1 });
  const helmetMat = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.3, metalness: 0.05 });
  const goggleMat = new THREE.MeshStandardMaterial({ color: 0x18324a, roughness: 0.15, metalness: 0.4 });

  // ── Pelvis / hips ──
  const hips = new THREE.Group();
  group.add(hips);
  const pelvis = box(0.17, 0.11, 0.13, pantsMat);
  pelvis.position.y = 0.05;
  hips.add(pelvis);

  // ── Torso ──
  const torso = new THREE.Group();
  torso.position.set(0, 0.1, 0);
  hips.add(torso);
  const chest = box(0.21, 0.26, 0.14, jerseyMat);
  chest.position.set(0, 0.13, 0);
  torso.add(chest);
  const chestProtector = box(0.19, 0.18, 0.03, new THREE.MeshStandardMaterial({ color: 0x1d1d20, roughness: 0.5 }));
  chestProtector.position.set(0, 0.15, 0.078);
  torso.add(chestProtector);

  // ── Head / helmet ──
  const neck = new THREE.Group();
  neck.position.set(0, 0.28, 0.01);
  torso.add(neck);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 12), helmetMat);
  helmet.position.set(0, 0.08, 0.01);
  helmet.scale.set(0.92, 1, 1.05);
  helmet.castShadow = true;
  neck.add(helmet);
  const peak = box(0.13, 0.018, 0.11, jerseyMat);
  peak.position.set(0, 0.145, 0.06);
  peak.rotation.x = -0.3;
  neck.add(peak);
  const goggles = box(0.125, 0.05, 0.02, goggleMat);
  goggles.position.set(0, 0.09, 0.098);
  neck.add(goggles);
  const chin = box(0.09, 0.05, 0.07, helmetMat);
  chin.position.set(0, 0.015, 0.075);
  neck.add(chin);

  // ── Arms ──
  interface Arm { shoulder: THREE.Group; elbow: THREE.Group }
  function makeArm(sx: number): Arm {
    const shoulder = new THREE.Group();
    shoulder.position.set(sx * 0.12, 0.235, 0.01);
    torso.add(shoulder);
    const upper = box(0.06, 0.2, 0.065, jerseyMat);
    upper.position.y = -0.09;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.19;
    shoulder.add(elbow);
    const fore = box(0.05, 0.18, 0.055, jerseyMat);
    fore.position.y = -0.08;
    elbow.add(fore);
    const glove = box(0.05, 0.06, 0.06, skinMat);
    glove.position.y = -0.185;
    elbow.add(glove);
    return { shoulder, elbow };
  }
  const armL = makeArm(1);
  const armR = makeArm(-1);

  // ── Legs ──
  interface Leg { hip: THREE.Group; knee: THREE.Group }
  function makeLeg(sx: number): Leg {
    const hip = new THREE.Group();
    hip.position.set(sx * 0.075, 0.01, -0.01);
    hips.add(hip);
    const thigh = box(0.075, 0.22, 0.095, pantsMat);
    thigh.position.y = -0.1;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.21;
    hip.add(knee);
    const shin = box(0.065, 0.2, 0.075, bootMat);
    shin.position.y = -0.09;
    knee.add(shin);
    const boot = box(0.07, 0.06, 0.17, bootMat);
    boot.position.set(0, -0.19, 0.04);
    knee.add(boot);
    return { hip, knee };
  }
  const legL = makeLeg(1);
  const legR = makeLeg(-1);

  // ── Pose state (smoothed) ──
  const cur = { crouch: 0, back: 0, legOutL: 0, legOutR: 0, tuck: 0 };

  function update(pose: RiderPose, dt: number): void {
    const s = Math.min(1, dt * 9);
    cur.crouch = lerp(cur.crouch, pose.crouch, s);
    cur.back = lerp(cur.back, pose.back, s);
    cur.tuck = lerp(cur.tuck, pose.tuck, s);
    cur.legOutL = lerp(cur.legOutL, pose.legOut > 0 ? 1 : 0, s * 0.8);
    cur.legOutR = lerp(cur.legOutR, pose.legOut < 0 ? 1 : 0, s * 0.8);

    const c = cur.crouch, b = cur.back, tk = cur.tuck;

    // hips rise when standing, slide back on wheelie
    hips.position.y = c * 0.13 - tk * 0.05;
    hips.position.z = -b * 0.1 - c * 0.03;

    // torso: forward attack lean when standing, upright/back on wheelie
    torso.rotation.x = lerp(lerp(0.42, 0.62, c), -0.25, b) + tk * 0.25;
    neck.rotation.x = -torso.rotation.x * 0.85; // keep eyes on the track

    // arms reach bars: shoulders forward-down, elbows bent & UP (moto style)
    const shX = lerp(lerp(-0.95, -1.2, c), -0.55, b) - tk * 0.15;
    const elX = lerp(lerp(0.85, 1.05, c), 0.35, b);
    armL.shoulder.rotation.x = shX;
    armR.shoulder.rotation.x = shX;
    armL.shoulder.rotation.z = -0.55 - c * 0.15; // elbows out
    armR.shoulder.rotation.z = 0.55 + c * 0.15;
    armL.elbow.rotation.x = elX;
    armR.elbow.rotation.x = elX;

    // legs: seated = knees bent onto pegs; standing = straighter
    const legPose = (out: number) => ({
      hipX: lerp(lerp(-1.0, -0.5, c), -1.45, out),
      kneeX: lerp(lerp(1.35, 0.72, c), 0.25, out),
    });
    const L = legPose(cur.legOutL);
    const Rp = legPose(cur.legOutR);
    legL.hip.rotation.x = L.hipX;
    legL.knee.rotation.x = L.kneeX;
    legL.hip.rotation.z = -cur.legOutL * 0.25;
    legR.hip.rotation.x = Rp.hipX;
    legR.knee.rotation.x = Rp.kneeX;
    legR.hip.rotation.z = cur.legOutR * 0.25;
  }

  // initialize into seated pose
  update({ crouch: 0, back: 0, legOut: 0, tuck: 0 }, 1);

  return {
    group,
    setJerseyColor: (c: THREE.Color) => { jerseyMat.color.copy(c); (peak.material as THREE.MeshStandardMaterial).color.copy(c); },
    update,
  };
}
