import * as THREE from 'three';
import type { BikeState } from './types';
import { makePlateTexture } from './textures';

// ── Bike State (gameplay) ──
export const mxBike: BikeState = {
  t: 0, lat: 0, speed: 0, maxSpeed: 16, accel: 12, brake: 8,
  turnSpeed: 3.8, angle: 0, airborne: false, jumpVel: 0, hOff: 0,
  lean: 0, driftFactor: 0, pos: new THREE.Vector3(), suspBob: 0,
  wheelie: false, wheelieBalance: 0, wheelieTime: 0,
  vy: 0, pitch: 0, pitchVel: 0, latVel: 0, slide: 0, gear: 0, rpm: 0, bank: 0,
};

export function resetBike(): void {
  mxBike.t = 0; mxBike.lat = 0; mxBike.speed = 0; mxBike.angle = 0;
  mxBike.airborne = false; mxBike.jumpVel = 0; mxBike.hOff = 0;
  mxBike.lean = 0; mxBike.driftFactor = 0; mxBike.suspBob = 0;
  mxBike.wheelie = false; mxBike.wheelieBalance = 0; mxBike.wheelieTime = 0;
  mxBike.vy = 0; mxBike.pitch = 0; mxBike.pitchVel = 0;
  mxBike.latVel = 0; mxBike.slide = 0; mxBike.gear = 0; mxBike.rpm = 0; mxBike.bank = 0;
}

// ═══════════════════════════════════════════════════════════════
//  PROCEDURAL MX BIKE — shared factory used by the game and the
//  garage preview. Built at world scale: tire contact at y=-0.35,
//  wheelbase 1.2, front axle z=+0.62, rear axle z=-0.58.
// ═══════════════════════════════════════════════════════════════

export type BikePart = 'tires' | 'engine' | 'gearbox' | 'suspension' | 'body';

export interface BikeRefs {
  group: THREE.Group;
  frontEnd: THREE.Group;    // steering head assembly (rotated to rake angle)
  frontSlider: THREE.Group; // lower fork legs + front wheel — slides for travel
  fWheel: THREE.Group;
  rearSwing: THREE.Group;   // swingarm pivot group — rotates for travel
  rWheel: THREE.Group;
  bars: THREE.Group;
  bodyMats: THREE.MeshStandardMaterial[];
  partMap: Record<BikePart, THREE.Mesh[]>;
  tankMesh: THREE.Mesh;
  seatMesh: THREE.Mesh;
}

const Y_UP = new THREE.Vector3(0, 1, 0);

function tube(from: [number, number, number], to: [number, number, number], r: number, mat: THREE.Material, seg = 8): THREE.Mesh {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(Y_UP, dir.normalize());
  return m;
}

function box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

// Side-profile bodywork: draw a closed outline in (z, y) bike-space via the
// callback, extruded to `width` across the bike (x), centered on x=0.
function profileMesh(draw: (s: THREE.Shape) => void, width: number, mat: THREE.Material, bevel = 0.006): THREE.Mesh {
  const sh = new THREE.Shape();
  draw(sh);
  const g = new THREE.ExtrudeGeometry(sh, {
    depth: width, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: 2, curveSegments: 14,
  });
  g.rotateY(-Math.PI / 2);   // profile x → bike z, extrusion → bike x
  g.translate(width / 2, 0, 0);
  return new THREE.Mesh(g, mat);
}

// Curved pipe along control points
function pipe(pts: [number, number, number][], r: number, mat: THREE.Material, rSegs = 10): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 32, r, rSegs), mat);
}

export function createBikeModel(bodyColor: THREE.Color | number = 0xff5a0a, plateNum = '7'): BikeRefs {
  const group = new THREE.Group();
  const bodyMats: THREE.MeshStandardMaterial[] = [];
  const partMap: Record<BikePart, THREE.Mesh[]> = { tires: [], engine: [], gearbox: [], suspension: [], body: [] };

  // ── Materials ──
  const mkBody = () => {
    const m = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.35, metalness: 0.05 });
    bodyMats.push(m);
    return m;
  };
  const bodyMat = mkBody();
  const whitePlastic = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.5, metalness: 0.02 });
  const blackPlastic = new THREE.MeshStandardMaterial({ color: 0x1d1d20, roughness: 0.7, metalness: 0.05 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.95, metalness: 0 });
  const alu = new THREE.MeshStandardMaterial({ color: 0xaab0b6, roughness: 0.32, metalness: 0.85 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc8a34a, roughness: 0.28, metalness: 0.85 });
  const steelDark = new THREE.MeshStandardMaterial({ color: 0x4a4e54, roughness: 0.42, metalness: 0.7 });
  const engineAlu = new THREE.MeshStandardMaterial({ color: 0x84888e, roughness: 0.45, metalness: 0.8 });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x232326, roughness: 0.95, metalness: 0 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2b2b30, roughness: 0.45, metalness: 0.6 });
  const plateTex = makePlateTexture(plateNum);
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: plateTex, roughness: 0.5 });

  const add = (m: THREE.Mesh, part: BikePart, parent: THREE.Object3D = group, shadow = true): THREE.Mesh => {
    m.castShadow = shadow;
    parent.add(m);
    partMap[part].push(m);
    return m;
  };

  // ── Wheels ──
  function makeWheel(R: number, minor: number, isFront: boolean): THREE.Group {
    const w = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.TorusGeometry(R - minor, minor, 12, 28), rubber);
    tire.rotation.y = Math.PI / 2;
    tire.castShadow = true;
    w.add(tire);
    partMap.tires.push(tire);
    // knob blocks — center row + staggered side rows
    const knobGeo = new THREE.BoxGeometry(minor * 1.7, 0.028, 0.03);
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const kn = new THREE.Mesh(knobGeo, rubber);
      const kr = R - 0.012;
      kn.position.set(0, Math.sin(a) * kr, Math.cos(a) * kr);
      kn.rotation.x = -a;
      w.add(kn);
      partMap.tires.push(kn);
      const side = new THREE.Mesh(knobGeo, rubber);
      const a2 = a + Math.PI / 20;
      side.position.set(i % 2 === 0 ? minor * 0.75 : -minor * 0.75, Math.sin(a2) * (kr - 0.006), Math.cos(a2) * (kr - 0.006));
      side.rotation.x = -a2;
      side.scale.set(0.6, 0.9, 0.9);
      w.add(side);
      partMap.tires.push(side);
    }
    // rim + spokes + hub
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R - 0.075, 0.013, 8, 24), blackPlastic);
    rim.rotation.y = Math.PI / 2;
    w.add(rim);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, R - 0.08, 4), alu);
      const mid = (R - 0.08) / 2 + 0.028;
      sp.position.set(i % 2 === 0 ? 0.012 : -0.012, Math.sin(a) * mid, Math.cos(a) * mid);
      sp.rotation.x = a + Math.PI / 2;
      w.add(sp);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.07, 12), steelDark);
    hub.rotation.z = Math.PI / 2;
    w.add(hub);
    // brake disc
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(isFront ? 0.09 : 0.072, isFront ? 0.09 : 0.072, 0.006, 20), alu);
    disc.rotation.z = Math.PI / 2;
    disc.position.x = isFront ? 0.042 : -0.042;
    w.add(disc);
    partMap.suspension.push(disc);
    if (!isFront) {
      // rear sprocket (anodized, body color pop)
      const spr = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.01, 20), mkBody());
      spr.rotation.z = Math.PI / 2;
      spr.position.x = 0.045;
      w.add(spr);
      partMap.gearbox.push(spr);
    }
    return w;
  }

  // ═══ FRONT END — forks / bars / wheel (raked steering assembly) ═══
  const TP: [number, number, number] = [0, 0.46, 0.33]; // top triple clamp
  const RAKE = -0.494;
  const frontEnd = new THREE.Group();
  frontEnd.position.set(...TP);
  frontEnd.rotation.x = RAKE;
  group.add(frontEnd);

  // triple clamps
  add(box(0.17, 0.03, 0.07, blackPlastic), 'suspension', frontEnd).position.set(0, 0, 0);
  add(box(0.16, 0.028, 0.065, blackPlastic), 'suspension', frontEnd).position.set(0, -0.15, 0);
  // upper fork tubes (gold anodized)
  for (const sx of [1, -1]) {
    const up = add(new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.34, 10), gold), 'suspension', frontEnd);
    up.position.set(sx * 0.064, -0.1, 0);
  }
  // front slider — lower legs + wheel, moves with suspension travel
  const frontSlider = new THREE.Group();
  frontEnd.add(frontSlider);
  for (const sx of [1, -1]) {
    const guard = add(new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.028, 0.27, 10), mkBody()), 'suspension', frontSlider);
    guard.position.set(sx * 0.064, -0.36, 0);
    const lower = add(new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.2, 10), blackPlastic), 'suspension', frontSlider);
    lower.position.set(sx * 0.064, -0.52, 0);
  }
  const fWheel = makeWheel(0.27, 0.045, true);
  fWheel.position.set(0, -0.613, 0);
  frontSlider.add(fWheel);
  // brake caliper
  const caliper = add(box(0.03, 0.07, 0.05, mkBody()), 'suspension', frontSlider);
  caliper.position.set(0.055, -0.56, 0.045);

  // handlebars — counter-rotated back to level
  const bars = new THREE.Group();
  bars.position.set(0, 0.05, 0);
  bars.rotation.x = -RAKE;
  frontEnd.add(bars);
  add(box(0.03, 0.05, 0.035, blackPlastic), 'body', bars).position.set(0.035, 0.02, 0);
  add(box(0.03, 0.05, 0.035, blackPlastic), 'body', bars).position.set(-0.035, 0.02, 0);
  add(tube([-0.1, 0.055, 0], [0.1, 0.055, 0], 0.009, steelDark), 'body', bars);
  for (const sx of [1, -1]) {
    add(tube([sx * 0.1, 0.055, 0], [sx * 0.21, 0.07, -0.055], 0.009, steelDark), 'body', bars);
    const grip = add(new THREE.Mesh(new THREE.CylinderGeometry(0.0135, 0.0135, 0.09, 8), rubber), 'body', bars);
    grip.position.set(sx * 0.235, 0.073, -0.065);
    grip.rotation.z = Math.PI / 2;
    // levers
    add(tube([sx * 0.185, 0.075, -0.05], [sx * 0.13, 0.075, 0.02], 0.004, alu), 'body', bars);
  }
  // crossbar + pad
  add(tube([-0.09, 0.1, -0.02], [0.09, 0.1, -0.02], 0.0055, alu), 'body', bars);
  const pad = add(box(0.1, 0.032, 0.036, mkBody()), 'body', bars);
  pad.position.set(0, 0.1, -0.02);

  // front number plate (on the steering head)
  const fPlate = add(box(0.13, 0.15, 0.016, plateMat), 'body', bars);
  fPlate.position.set(0, -0.035, 0.06);
  fPlate.rotation.x = RAKE - 0.1;

  // front fender — curved MX arch with upturned tip, mounted to lower triple
  const fFender = add(profileMesh(s => {
    s.moveTo(0.30, 0.235);
    s.quadraticCurveTo(0.42, 0.315, 0.56, 0.31);       // rise to apex
    s.quadraticCurveTo(0.70, 0.30, 0.79, 0.255);       // sweep down
    s.quadraticCurveTo(0.84, 0.235, 0.85, 0.27);       // tip flick
    s.lineTo(0.80, 0.285);
    s.quadraticCurveTo(0.70, 0.32, 0.56, 0.332);       // underside back
    s.quadraticCurveTo(0.42, 0.335, 0.315, 0.26);
    s.closePath();
  }, 0.095, mkBody()), 'body', group);

  // ═══ FRAME ═══
  add(tube([0, 0.4, 0.3], [0.05, 0.0, -0.06], 0.016, frameMat), 'body');
  add(tube([0, 0.4, 0.3], [-0.05, 0.0, -0.06], 0.016, frameMat), 'body');
  add(tube([0, 0.37, 0.32], [0, -0.06, 0.2], 0.015, frameMat), 'body');
  add(tube([0.05, -0.1, 0.16], [0.05, -0.1, -0.04], 0.012, frameMat), 'body');
  add(tube([-0.05, -0.1, 0.16], [-0.05, -0.1, -0.04], 0.012, frameMat), 'body');
  add(tube([0, -0.06, 0.2], [0.05, -0.1, 0.16], 0.012, frameMat), 'body');
  add(tube([0, -0.06, 0.2], [-0.05, -0.1, 0.16], 0.012, frameMat), 'body');
  // subframe
  add(tube([0.045, 0.24, -0.08], [0.04, 0.33, -0.5], 0.009, alu), 'body');
  add(tube([-0.045, 0.24, -0.08], [-0.04, 0.33, -0.5], 0.009, alu), 'body');
  add(tube([0.05, 0.02, -0.05], [0.04, 0.33, -0.48], 0.009, alu), 'body');
  add(tube([-0.05, 0.02, -0.05], [-0.04, 0.33, -0.48], 0.009, alu), 'body');
  // steering head
  const head = add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 10), frameMat), 'body');
  head.position.set(0, 0.4, 0.31);
  head.rotation.x = RAKE;

  // ═══ TANK + SHROUDS ═══
  // Fuel tank — shaped side profile, humped at the filler, tucking under seat
  const tankMesh = add(profileMesh(s => {
    s.moveTo(0.26, 0.285);
    s.quadraticCurveTo(0.27, 0.375, 0.20, 0.405);      // front face up to filler hump
    s.quadraticCurveTo(0.13, 0.425, 0.05, 0.395);      // hump crest
    s.lineTo(0.0, 0.36);                                // fall to seat junction
    s.lineTo(0.02, 0.29);
    s.closePath();
  }, 0.125, bodyMat), 'body');
  // filler cap
  const cap = add(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.02, 12), blackPlastic), 'body');
  cap.position.set(0, 0.418, 0.12);
  // radiator shrouds — angular two-tone scoops flaring from tank to radiator
  for (const sx of [1, -1]) {
    const shroud = add(profileMesh(s => {
      s.moveTo(0.34, 0.30);                             // front point
      s.quadraticCurveTo(0.30, 0.40, 0.16, 0.41);       // top edge hugging tank
      s.lineTo(0.02, 0.36);                             // rear top
      s.lineTo(0.08, 0.24);                             // rear notch
      s.lineTo(0.20, 0.20);                             // bottom rear corner
      s.quadraticCurveTo(0.30, 0.20, 0.34, 0.30);       // scoop mouth
      s.closePath();
    }, 0.016, mkBody(), 0.003), 'body');
    shroud.position.set(sx * 0.085, 0, 0.005);
    shroud.rotation.set(0, -sx * 0.14, sx * 0.12);
    const shroudLow = add(profileMesh(s => {
      s.moveTo(0.33, 0.27);
      s.lineTo(0.24, 0.185);
      s.lineTo(0.12, 0.155);
      s.lineTo(0.10, 0.22);
      s.quadraticCurveTo(0.22, 0.20, 0.33, 0.27);
      s.closePath();
    }, 0.014, whitePlastic, 0.003), 'body');
    shroudLow.position.set(sx * 0.078, -0.015, 0.02);
    shroudLow.rotation.set(0, -sx * 0.14, sx * 0.3);
    // radiator behind shroud
    const rad = add(box(0.035, 0.13, 0.09, steelDark), 'engine');
    rad.position.set(sx * 0.055, 0.18, 0.24);
    // airbox / side panel filling under the seat
    const air = add(box(0.016, 0.12, 0.22, bodyMat), 'body');
    air.position.set(sx * 0.058, 0.24, -0.1);
    air.rotation.set(0, 0, sx * 0.06);
  }

  // ═══ SEAT + REAR BODY ═══
  // Seat — long flat MX profile: dished where the rider sits, rising over
  // the tank junction at the front and tapering at the rear
  const seatMesh = add(profileMesh(s => {
    s.moveTo(0.14, 0.375);                              // front, meets tank hump
    s.quadraticCurveTo(0.0, 0.385, -0.14, 0.372);       // dish
    s.quadraticCurveTo(-0.30, 0.375, -0.40, 0.40);      // rise to rear
    s.lineTo(-0.41, 0.36);                              // rear face
    s.quadraticCurveTo(-0.20, 0.335, 0.10, 0.335);      // underside
    s.closePath();
  }, 0.1, seatMat, 0.004), 'body');
  // rear fender — swept curve kicking up over the rear wheel
  const rFender = add(profileMesh(s => {
    s.moveTo(-0.36, 0.40);
    s.quadraticCurveTo(-0.52, 0.44, -0.66, 0.52);       // upward sweep
    s.quadraticCurveTo(-0.72, 0.555, -0.735, 0.55);     // tip
    s.lineTo(-0.72, 0.525);
    s.quadraticCurveTo(-0.60, 0.47, -0.38, 0.373);      // underside back to seat
    s.closePath();
  }, 0.09, bodyMat), 'body');
  // side number plates
  for (const sx of [1, -1]) {
    const sp = add(box(0.018, 0.16, 0.23, plateMat), 'body');
    sp.position.set(sx * 0.072, 0.27, -0.35);
    sp.rotation.set(0, sx * 0.14, sx * 0.08);
  }

  // ═══ ENGINE ═══
  const blockM = add(box(0.12, 0.17, 0.2, engineAlu), 'engine');
  blockM.position.set(0, 0.02, 0.05);
  const cyl = add(box(0.09, 0.13, 0.09, engineAlu), 'engine');
  cyl.rotation.x = -0.5;
  cyl.position.set(0, 0.15, 0.12);
  const headC = add(box(0.078, 0.05, 0.075, steelDark), 'engine');
  headC.rotation.x = -0.5;
  headC.position.set(0, 0.22, 0.155);
  // cooling fins on the cylinder
  for (let i = 0; i < 4; i++) {
    const fin = add(box(0.104, 0.006, 0.1, steelDark), 'engine');
    fin.rotation.x = -0.5;
    const ft = i / 3;
    fin.position.set(0, 0.115 + ft * 0.075, 0.095 + ft * 0.041);
  }
  const clutch = add(new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.024, 16), engineAlu), 'engine');
  clutch.rotation.z = Math.PI / 2;
  clutch.position.set(0.068, 0.0, 0.02);
  const ign = add(new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.02, 16), engineAlu), 'engine');
  ign.rotation.z = Math.PI / 2;
  ign.position.set(-0.066, 0.0, 0.02);
  const skid = add(box(0.11, 0.015, 0.26, alu), 'engine');
  skid.position.set(0, -0.095, 0.04);
  // footpegs
  for (const sx of [1, -1]) {
    const peg = add(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.075, 6), steelDark), 'body');
    peg.rotation.z = Math.PI / 2;
    peg.position.set(sx * 0.1, -0.055, -0.06);
  }
  // shift lever / rear brake pedal
  add(tube([-0.065, -0.045, 0.02], [-0.11, -0.055, 0.09], 0.006, steelDark), 'body');
  add(tube([0.065, -0.045, 0.02], [0.1, -0.06, 0.12], 0.006, steelDark), 'body');

  // ═══ EXHAUST (right side) — one continuous curved header into silencer ═══
  add(pipe([
    [0, 0.21, 0.19],        // head exit
    [0.06, 0.13, 0.30],     // sweep out + down
    [0.10, -0.02, 0.18],    // down the front of the cases
    [0.105, -0.015, -0.10], // run under the frame rail
    [0.09, 0.06, -0.26],    // kick up toward silencer
    [0.082, 0.135, -0.34],
  ], 0.021, steelDark), 'engine');
  const silencer = add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.28, 14), alu), 'engine');
  silencer.position.set(0.08, 0.165, -0.43);
  silencer.rotation.x = Math.PI / 2 - 0.22;
  const endCap = add(new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.035, 12), blackPlastic), 'engine');
  endCap.position.set(0.08, 0.197, -0.565);
  endCap.rotation.x = Math.PI / 2 - 0.22;

  // ═══ REAR SWINGARM + WHEEL ═══
  const rearSwing = new THREE.Group();
  rearSwing.position.set(0, -0.02, -0.05);
  group.add(rearSwing);
  for (const sx of [1, -1]) {
    const arm = add(box(0.026, 0.05, 0.54, alu), 'suspension', rearSwing);
    arm.position.set(sx * 0.055, -0.035, -0.265);
    arm.rotation.x = 0.13;
  }
  const rWheel = makeWheel(0.26, 0.06, false);
  rWheel.position.set(0, -0.07, -0.53);
  rearSwing.add(rWheel);
  // chain run + guide (travels with swingarm)
  const chain = add(box(0.014, 0.008, 0.5, blackPlastic), 'gearbox', rearSwing);
  chain.position.set(0.052, -0.005, -0.26);
  chain.rotation.x = 0.12;
  const chainB = add(box(0.014, 0.008, 0.5, blackPlastic), 'gearbox', rearSwing);
  chainB.position.set(0.052, -0.115, -0.26);
  chainB.rotation.x = 0.14;
  const guide = add(box(0.02, 0.05, 0.09, mkBody()), 'gearbox', rearSwing);
  guide.position.set(0.052, -0.1, -0.45);
  // front sprocket
  const fSpr = add(new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.014, 12), steelDark), 'gearbox');
  fSpr.rotation.z = Math.PI / 2;
  fSpr.position.set(0.055, -0.03, -0.04);
  // swingarm pivot bolt
  const pivot = add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.13, 10), alu), 'suspension');
  pivot.rotation.z = Math.PI / 2;
  pivot.position.set(0, -0.02, -0.05);

  // ═══ REAR SHOCK ═══
  add(tube([0, 0.26, -0.1], [0, 0.0, -0.17], 0.016, gold), 'suspension');
  for (let i = 0; i < 5; i++) {
    const coil = add(new THREE.Mesh(new THREE.TorusGeometry(0.033, 0.006, 6, 14), new THREE.MeshStandardMaterial({ color: 0xd0342c, roughness: 0.4, metalness: 0.6 })), 'suspension');
    const tt = i / 4;
    coil.position.set(0, 0.21 - tt * 0.14, -0.115 - tt * 0.045);
    coil.rotation.x = Math.PI / 2 - 0.26;
  }

  return { group, frontEnd, frontSlider, fWheel, rearSwing, rWheel, bars, bodyMats, partMap, tankMesh, seatMesh };
}

// ═══ Game instance ═══
export const bike = createBikeModel(0xff5a0a, '7');
export const bikeGroup = bike.group;
bikeGroup.visible = false;
bikeGroup.renderOrder = 1;
// YXZ order: heading (Y) in world, tilt (X) and lean (Z) in bike's local frame
bikeGroup.rotation.order = 'YXZ';

export const fWheelGroup = bike.fWheel;
export const rWheelGroup = bike.rWheel;
// Legacy exports (shop / older modules referenced tank + seat directly)
export const frame = bike.tankMesh;
export const seat = bike.seatMesh;

export function setBikeBodyColor(c: THREE.Color): void {
  bike.bodyMats.forEach(m => m.color.copy(c));
  // untextured GLB plastics read washed out under ACES — boost sat a touch
  const cv = c.clone();
  cv.offsetHSL(0, 0.09, 0.015);
  pendingColor = cv.clone();
  if (glbRig) glbRig.tintMats.forEach(m => m.color.copy(cv));
  riderRig?.setJerseyColor(cv);
  setPlateTint(cv);
}

// f/r: 0..1 suspension compression
const FRONT_TRAVEL = 0.11;
const REAR_TRAVEL = 0.17;
export function updateSuspension(f: number, r: number): void {
  bike.frontSlider.position.y = f * FRONT_TRAVEL;
  bike.rearSwing.rotation.x = r * REAR_TRAVEL;
}

// ═══ Hero GLB bike (CRF450) — swaps in over the procedural model ═══
import { loadGlbBike, setPlateTint, type GlbBikeRig } from './bike-glb';
import { loadGlbRider, type RiderRig, type RiderPose } from './rider-glb';

let glbRig: GlbBikeRig | null = null;
let riderRig: RiderRig | null = null;
let pendingColor: THREE.Color | null = null;

// Rider hips mount in bike space (the rig's RIDER-ATTATCH bone sits inside
// the engine, so we place the hips at real seat height ourselves)
export const RIDER_MOUNT = { x: 0, y: 0.46, z: -0.12, ry: 0 };

export function isGlbBikeActive(): boolean { return glbRig !== null; }

export function initHeroBike(): void {
  const noRider = new URLSearchParams(location.search).has('norider');
  Promise.all([loadGlbBike(), noRider ? Promise.resolve(null) : loadGlbRider()]).then(([rig, rider]) => {
    if (rig) {
      glbRig = rig;
      // hide the procedural bodywork, keep the group as the physics anchor
      for (const child of [...bikeGroup.children]) {
        if (child !== rig.root && child.name !== 'rider') child.visible = false;
      }
      bikeGroup.add(rig.root);
      if (pendingColor) rig.tintMats.forEach(m => m.color.copy(pendingColor!));
      for (const [part, lvl] of Object.entries(pendingTiers)) rig.setPartLevel(part as BikePartKey, lvl);
    }
    if (rider) {
      riderRig = rider;
      bikeGroup.add(rider.root);
      rider.root.position.set(RIDER_MOUNT.x, RIDER_MOUNT.y, RIDER_MOUNT.z);
      if (rig) rider.attach(rig.mounts);
      if (pendingColor) rider.setJerseyColor(pendingColor);
    }
  });
}

// Drive the rider's pose from gameplay (no-op until the rider loads)
export function updateRiderPose(pose: RiderPose, dt: number): void {
  riderRig?.update(pose, dt);
}

// Upgrade tier tints (bronze/silver/gold) on the hero bike's parts
import type { BikePartKey } from './bike-glb';
const pendingTiers: Partial<Record<BikePartKey, number>> = {};
export function setPartTier(part: BikePartKey, level: number): void {
  pendingTiers[part] = level;
  glbRig?.setPartLevel(part, level);
}

// Wheel spin for whichever model is active
export function spinWheels(delta: number): void {
  if (glbRig) glbRig.spin(delta);
  else { bike.fWheel.rotation.x += delta; bike.rWheel.rotation.x += delta; }
}
