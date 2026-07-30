import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════
//  PROCEDURAL MX RIDER — articulated figure with rounded (capsule)
//  limbs and proper gear silhouette: helmet + peak + goggles,
//  chest protector, gloves, knee-braced pants, MX boots.
//  Poses: seated, attack (standing), wheelie (weight back),
//  cornering leg-out, in-air tuck.
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

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function capsule(r: number, len: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat);
  m.castShadow = true;
  return m;
}

function box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  return m;
}

export function createRider(jersey: THREE.Color | number = 0xff5a0a): RiderRig {
  const group = new THREE.Group();
  // root sits above the seat
  group.position.set(0, 0.385, -0.1);

  const jerseyMat = new THREE.MeshStandardMaterial({ color: jersey, roughness: 0.75, metalness: 0 });
  const jerseyDark = new THREE.MeshStandardMaterial({ color: 0x1d1d20, roughness: 0.78, metalness: 0 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x26262b, roughness: 0.8, metalness: 0 });
  const gloveMat = new THREE.MeshStandardMaterial({ color: 0x1f1f22, roughness: 0.85, metalness: 0 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: 0.55, metalness: 0.12 });
  const bootAccent = new THREE.MeshStandardMaterial({ color: 0x4a443c, roughness: 0.5, metalness: 0.15 });
  const helmetMat = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.28, metalness: 0.05 });
  const goggleMat = new THREE.MeshStandardMaterial({ color: 0x18324a, roughness: 0.12, metalness: 0.45 });
  const armorMat = new THREE.MeshStandardMaterial({ color: 0x1d1d20, roughness: 0.45, metalness: 0.1 });

  // ── Pelvis / hips ──
  const hips = new THREE.Group();
  group.add(hips);
  const pelvis = capsule(0.075, 0.06, pantsMat);
  pelvis.rotation.z = Math.PI / 2;
  pelvis.position.y = 0.05;
  hips.add(pelvis);

  // ── Torso ──
  const torso = new THREE.Group();
  torso.position.set(0, 0.1, 0);
  hips.add(torso);
  // rounded chest — capsule laid vertically, slightly flattened
  const chest = capsule(0.095, 0.13, jerseyMat);
  chest.position.set(0, 0.12, 0);
  chest.scale.set(1.05, 1, 0.72);
  torso.add(chest);
  // chest protector plate + shoulder cups
  const chestProtector = box(0.185, 0.17, 0.035, armorMat);
  chestProtector.position.set(0, 0.14, 0.075);
  torso.add(chestProtector);
  const backPlate = box(0.17, 0.2, 0.03, armorMat);
  backPlate.position.set(0, 0.12, -0.07);
  torso.add(backPlate);
  for (const sx of [1, -1]) {
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), jerseyDark);
    cup.position.set(sx * 0.12, 0.225, 0.005);
    cup.scale.set(1.15, 0.8, 1);
    cup.castShadow = true;
    torso.add(cup);
  }

  // ── Head / helmet ──
  const neck = new THREE.Group();
  neck.position.set(0, 0.28, 0.01);
  torso.add(neck);
  // neck brace
  const brace = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.02, 8, 14), armorMat);
  brace.rotation.x = Math.PI / 2;
  brace.position.set(0, 0.005, 0.01);
  neck.add(brace);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.095, 18, 14), helmetMat);
  helmet.position.set(0, 0.08, 0.01);
  helmet.scale.set(0.92, 1, 1.08);
  helmet.castShadow = true;
  neck.add(helmet);
  // visor peak — thin swept wedge
  const peak = box(0.13, 0.014, 0.11, jerseyMat);
  peak.position.set(0, 0.15, 0.055);
  peak.rotation.x = -0.32;
  neck.add(peak);
  // goggles wrap
  const goggles = box(0.128, 0.048, 0.02, goggleMat);
  goggles.position.set(0, 0.095, 0.1);
  neck.add(goggles);
  const strap = box(0.19, 0.022, 0.002, jerseyDark);
  strap.position.set(0, 0.095, 0.006);
  neck.add(strap);
  // chin bar — rounded capsule across the front
  const chin = capsule(0.032, 0.055, helmetMat);
  chin.rotation.z = Math.PI / 2;
  chin.position.set(0, 0.022, 0.088);
  neck.add(chin);

  // ── Arms ──
  interface Arm { shoulder: THREE.Group; elbow: THREE.Group }
  function makeArm(sx: number): Arm {
    const shoulder = new THREE.Group();
    shoulder.position.set(sx * 0.12, 0.235, 0.01);
    torso.add(shoulder);
    const upper = capsule(0.033, 0.12, jerseyMat);
    upper.position.y = -0.09;
    shoulder.add(upper);
    // elbow guard
    const guard = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 8), jerseyDark);
    guard.position.y = -0.185;
    guard.scale.set(1, 1.2, 1);
    shoulder.add(guard);
    const elbow = new THREE.Group();
    elbow.position.y = -0.19;
    shoulder.add(elbow);
    const fore = capsule(0.028, 0.1, jerseyMat);
    fore.position.y = -0.075;
    elbow.add(fore);
    const glove = capsule(0.026, 0.03, gloveMat);
    glove.position.y = -0.17;
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
    const thigh = capsule(0.045, 0.13, pantsMat);
    thigh.position.y = -0.1;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.21;
    hip.add(knee);
    // knee brace cup
    const kneeCup = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), bootAccent);
    kneeCup.position.set(0, 0.005, 0.02);
    kneeCup.scale.set(0.9, 1.1, 1);
    knee.add(kneeCup);
    const shin = capsule(0.036, 0.1, bootMat);
    shin.position.y = -0.08;
    knee.add(shin);
    // MX boot: shaped shaft + foot + sole
    const bootShaft = box(0.068, 0.1, 0.09, bootMat);
    bootShaft.position.set(0, -0.15, 0.005);
    knee.add(bootShaft);
    const bootStraps = box(0.072, 0.075, 0.02, bootAccent);
    bootStraps.position.set(0, -0.145, 0.05);
    knee.add(bootStraps);
    const foot = box(0.066, 0.045, 0.16, bootMat);
    foot.position.set(0, -0.2, 0.045);
    knee.add(foot);
    const sole = box(0.07, 0.014, 0.17, new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 }));
    sole.position.set(0, -0.228, 0.045);
    knee.add(sole);
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
