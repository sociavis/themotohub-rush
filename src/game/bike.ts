import * as THREE from 'three';
import { T, tC } from './themes';
import type { BikeState } from './types';

// ── Bike State ──
export const mxBike: BikeState = {
  t: 0, lat: 0, speed: 0, maxSpeed: 16, accel: 12, brake: 8,
  turnSpeed: 3.8, angle: 0, airborne: false, jumpVel: 0, hOff: 0,
  lean: 0, driftFactor: 0, pos: new THREE.Vector3(), suspBob: 0,
  wheelie: false, wheelieBalance: 0, wheelieTime: 0,
};

// ── Motocross Dirt Bike Model ──
// Rebuilt from scratch as a proper MX / motocross bike
// Reference: low-poly Kawasaki KX-style dirtbike
export const bikeGroup = new THREE.Group();

// ── Materials ──
const bodyMat = new THREE.MeshStandardMaterial({
  color: tC(T().primary), emissive: tC(T().primary),
  emissiveIntensity: 0.7, metalness: 0.7, roughness: 0.3,
});
const frameMat = new THREE.MeshStandardMaterial({
  color: 0x999999, metalness: 0.85, roughness: 0.15,
});
const darkMat = new THREE.MeshStandardMaterial({
  color: 0x1a1a1a, metalness: 0.3, roughness: 0.85,
});
const chromeMat = new THREE.MeshStandardMaterial({
  color: 0xcccccc, metalness: 0.92, roughness: 0.08,
});
const tireMat = new THREE.MeshStandardMaterial({
  color: 0x111111, metalness: 0.1, roughness: 0.95,
});
const whiteMat = new THREE.MeshStandardMaterial({
  color: 0xeeeeee, roughness: 0.55, metalness: 0.1,
});
const engineMat = new THREE.MeshStandardMaterial({
  color: 0x555555, metalness: 0.75, roughness: 0.35,
});
const seatMat = new THREE.MeshStandardMaterial({
  color: 0x1a1a1a, metalness: 0.15, roughness: 0.9,
});

// ═══════════════════════════════════════
// FRAME — Perimeter cradle frame
// ═══════════════════════════════════════

// Steering head / headstock (where forks pivot)
const headstock = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 8), frameMat.clone());
headstock.position.set(0, 0.2, 0.22);
headstock.rotation.x = -0.45;
bikeGroup.add(headstock);

// Main beam — headstock down to swingarm pivot (backbone)
const mainBeamL = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.48, 6), frameMat.clone());
mainBeamL.rotation.x = -0.18;
mainBeamL.position.set(0.035, 0.14, 0.02);
bikeGroup.add(mainBeamL);
const mainBeamR = mainBeamL.clone();
mainBeamR.position.x = -0.035;
bikeGroup.add(mainBeamR);

// Down tubes — from headstock area down to engine cradle
const downTubeL = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6), frameMat.clone());
downTubeL.rotation.x = 0.55;
downTubeL.position.set(0.035, 0.06, 0.16);
bikeGroup.add(downTubeL);
const downTubeR = downTubeL.clone();
downTubeR.position.x = -0.035;
bikeGroup.add(downTubeR);

// Lower cradle — under engine
const lowerCradleL = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.2, 6), frameMat.clone());
lowerCradleL.rotation.x = Math.PI / 2;
lowerCradleL.position.set(0.035, -0.08, 0.02);
bikeGroup.add(lowerCradleL);
const lowerCradleR = lowerCradleL.clone();
lowerCradleR.position.x = -0.035;
bikeGroup.add(lowerCradleR);

// Subframe / seat rails — extend rearward from main frame
const seatRailL = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.38, 6), frameMat.clone());
seatRailL.rotation.x = -0.22;
seatRailL.position.set(0.03, 0.14, -0.16);
bikeGroup.add(seatRailL);
const seatRailR = seatRailL.clone();
seatRailR.position.x = -0.03;
bikeGroup.add(seatRailR);

// ═══════════════════════════════════════
// ENGINE — Single-cylinder four-stroke
// ═══════════════════════════════════════

// Main engine cases
const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.16), engineMat.clone());
engineBlock.position.set(0, -0.01, 0.03);
bikeGroup.add(engineBlock);

// Cylinder (angled forward, MX style)
const cylinder = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.06), engineMat.clone());
cylinder.rotation.x = -0.6;
cylinder.position.set(0, 0.08, 0.1);
bikeGroup.add(cylinder);

// Cylinder head / valve cover
const valveCover = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.05), new THREE.MeshStandardMaterial({
  color: 0x444444, metalness: 0.6, roughness: 0.3,
}));
valveCover.rotation.x = -0.6;
valveCover.position.set(0, 0.14, 0.12);
bikeGroup.add(valveCover);

// Clutch cover (right side bulge)
const clutchCover = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 12), engineMat.clone());
clutchCover.rotation.z = Math.PI / 2;
clutchCover.position.set(0.06, -0.02, 0.02);
bikeGroup.add(clutchCover);

// Stator cover (left side)
const statorCover = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 12), engineMat.clone());
statorCover.rotation.z = Math.PI / 2;
statorCover.position.set(-0.06, -0.02, 0.02);
bikeGroup.add(statorCover);

// ═══════════════════════════════════════
// FUEL TANK (body-colored, angular MX shape)
// ═══════════════════════════════════════

// Main tank body — narrow and tall MX style
export const frame = new THREE.Mesh(
  new THREE.BoxGeometry(0.12, 0.09, 0.22),
  bodyMat.clone(),
);
frame.position.set(0, 0.22, 0.06);
bikeGroup.add(frame);

// Tank shrouds / radiator shrouds (angled body panels)
const shroudL = new THREE.Mesh(
  new THREE.BoxGeometry(0.012, 0.13, 0.2),
  bodyMat.clone(),
);
shroudL.position.set(0.065, 0.16, 0.06);
shroudL.rotation.z = 0.12;
bikeGroup.add(shroudL);
const shroudR = shroudL.clone();
shroudR.position.x = -0.065;
shroudR.rotation.z = -0.12;
bikeGroup.add(shroudR);

// Lower shroud extensions (radiator guard area)
const lowerShroudL = new THREE.Mesh(
  new THREE.BoxGeometry(0.01, 0.08, 0.12),
  bodyMat.clone(),
);
lowerShroudL.position.set(0.06, 0.06, 0.1);
bikeGroup.add(lowerShroudL);
const lowerShroudR = lowerShroudL.clone();
lowerShroudR.position.x = -0.06;
bikeGroup.add(lowerShroudR);

// ═══════════════════════════════════════
// SEAT — Flat, narrow MX seat (dark colored)
// ═══════════════════════════════════════

export const seat = new THREE.Mesh(
  new THREE.BoxGeometry(0.1, 0.03, 0.32),
  seatMat.clone(),
);
seat.position.set(0, 0.22, -0.14);
seat.rotation.x = 0.08;
bikeGroup.add(seat);

// ═══════════════════════════════════════
// REAR FENDER (body-colored, sweeps up high)
// ═══════════════════════════════════════

const rearFender = new THREE.Mesh(
  new THREE.BoxGeometry(0.09, 0.015, 0.2),
  bodyMat.clone(),
);
rearFender.position.set(0, 0.24, -0.3);
rearFender.rotation.x = 0.4;
bikeGroup.add(rearFender);

// Rear fender tail tip
const fenderTail = new THREE.Mesh(
  new THREE.BoxGeometry(0.06, 0.012, 0.06),
  bodyMat.clone(),
);
fenderTail.position.set(0, 0.3, -0.42);
fenderTail.rotation.x = 0.7;
bikeGroup.add(fenderTail);

// ═══════════════════════════════════════
// FRONT FORKS — Long-travel USD inverted forks
// ═══════════════════════════════════════

const FORK_ANGLE = -0.42; // steeper rake for MX

// Left fork — upper tube (thick, chrome/gold)
const forkUpperL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 8), chromeMat.clone());
forkUpperL.rotation.x = FORK_ANGLE;
forkUpperL.position.set(0.045, 0.14, 0.3);
bikeGroup.add(forkUpperL);

// Left fork — lower tube (thinner, black)
const forkLowerL = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 8), darkMat.clone());
forkLowerL.rotation.x = FORK_ANGLE;
forkLowerL.position.set(0.045, -0.05, 0.4);
bikeGroup.add(forkLowerL);

// Right fork upper
const forkUpperR = forkUpperL.clone();
forkUpperR.position.x = -0.045;
bikeGroup.add(forkUpperR);

// Right fork lower
const forkLowerR = forkLowerL.clone();
forkLowerR.position.x = -0.045;
bikeGroup.add(forkLowerR);

// Fork guards (small colored sleeves)
const forkGuardL = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.06, 8), bodyMat.clone());
forkGuardL.rotation.x = FORK_ANGLE;
forkGuardL.position.set(0.045, 0.02, 0.36);
bikeGroup.add(forkGuardL);
const forkGuardR = forkGuardL.clone();
forkGuardR.position.x = -0.045;
bikeGroup.add(forkGuardR);

// Triple clamp (upper)
const tripleUpper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.015, 0.035), chromeMat.clone());
tripleUpper.position.set(0, 0.28, 0.26);
tripleUpper.rotation.x = FORK_ANGLE * 0.3;
bikeGroup.add(tripleUpper);

// Triple clamp (lower)
const tripleLower = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.012, 0.03), chromeMat.clone());
tripleLower.position.set(0, 0.22, 0.28);
tripleLower.rotation.x = FORK_ANGLE * 0.3;
bikeGroup.add(tripleLower);

// ═══════════════════════════════════════
// FRONT FENDER — Tall-mounted between forks
// ═══════════════════════════════════════

const frontFender = new THREE.Mesh(
  new THREE.BoxGeometry(0.065, 0.012, 0.18),
  bodyMat.clone(),
);
frontFender.rotation.x = FORK_ANGLE;
frontFender.position.set(0, 0.06, 0.39);
bikeGroup.add(frontFender);

// Fender sides for more 3D shape
const fenderSideL = new THREE.Mesh(
  new THREE.BoxGeometry(0.01, 0.04, 0.14),
  bodyMat.clone(),
);
fenderSideL.rotation.x = FORK_ANGLE;
fenderSideL.position.set(0.035, 0.05, 0.38);
bikeGroup.add(fenderSideL);
const fenderSideR = fenderSideL.clone();
fenderSideR.position.x = -0.035;
bikeGroup.add(fenderSideR);

// ═══════════════════════════════════════
// HANDLEBARS — Wide MX bars with crossbar & pad
// ═══════════════════════════════════════

// Bar mounts / risers
const barMountL = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 6), darkMat.clone());
barMountL.position.set(0.025, 0.32, 0.24);
bikeGroup.add(barMountL);
const barMountR = barMountL.clone();
barMountR.position.x = -0.025;
bikeGroup.add(barMountR);

// Left handlebar
const barL = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 6), darkMat.clone());
barL.rotation.z = Math.PI / 2;
barL.position.set(0.09, 0.34, 0.24);
bikeGroup.add(barL);
const barR = barL.clone();
barR.position.x = -0.09;
bikeGroup.add(barR);

// Crossbar brace
const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.14, 6), chromeMat.clone());
crossbar.rotation.z = Math.PI / 2;
crossbar.position.set(0, 0.36, 0.24);
bikeGroup.add(crossbar);

// Bar pad (body-colored foam pad)
const barPad = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.022, 0.028), bodyMat.clone());
barPad.position.set(0, 0.36, 0.24);
bikeGroup.add(barPad);

// Grips (rubber)
const gripL = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.045, 6), darkMat.clone());
gripL.rotation.z = Math.PI / 2;
gripL.position.set(0.14, 0.34, 0.24);
bikeGroup.add(gripL);
const gripR = gripL.clone();
gripR.position.x = -0.14;
bikeGroup.add(gripR);

// ═══════════════════════════════════════
// NUMBER PLATE — Front (white)
// ═══════════════════════════════════════

const numberPlate = new THREE.Mesh(
  new THREE.BoxGeometry(0.1, 0.1, 0.012),
  whiteMat.clone(),
);
numberPlate.position.set(0, 0.24, 0.36);
numberPlate.rotation.x = -0.25;
bikeGroup.add(numberPlate);

// ═══════════════════════════════════════
// SIDE NUMBER PLATES (white panels on flanks)
// ═══════════════════════════════════════

const sidePlateL = new THREE.Mesh(
  new THREE.BoxGeometry(0.012, 0.1, 0.16),
  whiteMat.clone(),
);
sidePlateL.position.set(0.065, 0.13, -0.1);
sidePlateL.rotation.z = 0.05;
bikeGroup.add(sidePlateL);
const sidePlateR = sidePlateL.clone();
sidePlateR.position.x = -0.065;
sidePlateR.rotation.z = -0.05;
bikeGroup.add(sidePlateR);

// ═══════════════════════════════════════
// REAR SWINGARM — Longer for MX travel
// ═══════════════════════════════════════

const swingarmL = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.012, 0.38, 6), frameMat.clone());
swingarmL.rotation.set(0, 0, 0.06);
swingarmL.rotation.x = Math.PI / 2 + 0.05;
swingarmL.position.set(0.04, -0.06, -0.22);
bikeGroup.add(swingarmL);
const swingarmR = swingarmL.clone();
swingarmR.position.x = -0.04;
swingarmR.rotation.z = -0.06;
bikeGroup.add(swingarmR);

// Swingarm pivot bolt
const swingPivot = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.1, 8), chromeMat.clone());
swingPivot.rotation.z = Math.PI / 2;
swingPivot.position.set(0, -0.04, -0.04);
bikeGroup.add(swingPivot);

// ═══════════════════════════════════════
// REAR SHOCK — Single shock, centrally mounted
// ═══════════════════════════════════════

const rearShock = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.01, 0.22, 6), chromeMat.clone());
rearShock.rotation.x = -0.2;
rearShock.position.set(0, 0.06, -0.16);
bikeGroup.add(rearShock);

// Shock spring (visible coil — use a torus for the ring effect)
const shockSpring = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8), new THREE.MeshStandardMaterial({
  color: 0xddcc00, metalness: 0.8, roughness: 0.2,
}));
shockSpring.rotation.x = -0.2;
shockSpring.position.set(0, 0.04, -0.15);
bikeGroup.add(shockSpring);

// ═══════════════════════════════════════
// EXHAUST — Header pipe sweeps down, silencer mounts high
// ═══════════════════════════════════════

// Header pipe from cylinder
const exhaustHeader = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.16, 8), chromeMat.clone());
exhaustHeader.rotation.x = 0.5;
exhaustHeader.position.set(0.055, 0.01, 0.1);
bikeGroup.add(exhaustHeader);

// Mid pipe (goes under and back)
const exhaustMid = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.016, 0.22, 8), chromeMat.clone());
exhaustMid.rotation.x = Math.PI / 2 + 0.15;
exhaustMid.position.set(0.055, -0.06, -0.04);
bikeGroup.add(exhaustMid);

// Silencer (high-mounted MX style on right side)
const silencer = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.024, 0.18, 8), new THREE.MeshStandardMaterial({
  color: 0x3a3a3a, metalness: 0.5, roughness: 0.45,
}));
silencer.rotation.x = -0.08;
silencer.position.set(0.065, 0.1, -0.2);
bikeGroup.add(silencer);

// Silencer end cap
const silencerCap = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.02, 8), chromeMat.clone());
silencerCap.rotation.x = -0.08;
silencerCap.position.set(0.065, 0.11, -0.29);
bikeGroup.add(silencerCap);

// ═══════════════════════════════════════
// CHAIN & SPROCKETS
// ═══════════════════════════════════════

// Chain run (visual)
const chain = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.006, 0.38), darkMat.clone());
chain.position.set(0.03, -0.1, -0.16);
bikeGroup.add(chain);

// Front sprocket (small, at engine)
const fSprocket = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.005, 6, 10), chromeMat.clone());
fSprocket.rotation.y = Math.PI / 2;
fSprocket.position.set(0.03, -0.07, 0.0);
bikeGroup.add(fSprocket);

// Chain guide (on swingarm)
const chainGuide = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 0.2), darkMat.clone());
chainGuide.position.set(0.03, -0.1, -0.26);
bikeGroup.add(chainGuide);

// ═══════════════════════════════════════
// FRONT WHEEL — 21" MX with knobby tire
// ═══════════════════════════════════════

export const fWheelGroup = new THREE.Group();
fWheelGroup.position.set(0, -0.12, 0.5);

// Knobby tire (torus — slightly wider for MX)
const fTire = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.042, 10, 24), tireMat.clone());
fTire.rotation.y = Math.PI / 2;
fWheelGroup.add(fTire);

// Hub
const fHub = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 12), chromeMat.clone());
fHub.rotation.z = Math.PI / 2;
fWheelGroup.add(fHub);

// Brake rotor
const fBrake = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 4, 16), chromeMat.clone());
fBrake.rotation.y = Math.PI / 2;
fBrake.position.set(0.025, 0, 0);
fWheelGroup.add(fBrake);

// Spokes (crossed pattern — 12 spokes for more realism)
for (let i = 0; i < 12; i++) {
  const angle = (i / 12) * Math.PI * 2;
  const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.14, 4), chromeMat.clone());
  spoke.position.set(0, Math.sin(angle) * 0.085, Math.cos(angle) * 0.085);
  spoke.rotation.x = angle + (i % 2 === 0 ? 0.15 : -0.15);
  fWheelGroup.add(spoke);
}

bikeGroup.add(fWheelGroup);

// ═══════════════════════════════════════
// REAR WHEEL — 19" MX with wider knobby
// ═══════════════════════════════════════

export const rWheelGroup = new THREE.Group();
rWheelGroup.position.set(0, -0.12, -0.42);

// Wider knobby tire
const rTire = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.05, 10, 22), tireMat.clone());
rTire.rotation.y = Math.PI / 2;
rWheelGroup.add(rTire);

// Hub
const rHub = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.055, 12), chromeMat.clone());
rHub.rotation.z = Math.PI / 2;
rWheelGroup.add(rHub);

// Rear sprocket (larger)
const rSprocket = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.007, 6, 14), chromeMat.clone());
rSprocket.rotation.y = Math.PI / 2;
rSprocket.position.set(0.028, 0, 0);
rWheelGroup.add(rSprocket);

// Brake rotor
const rBrake = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.006, 4, 14), chromeMat.clone());
rBrake.rotation.y = Math.PI / 2;
rBrake.position.set(-0.025, 0, 0);
rWheelGroup.add(rBrake);

// Spokes (12 crossed)
for (let i = 0; i < 12; i++) {
  const angle = (i / 12) * Math.PI * 2;
  const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.12, 4), chromeMat.clone());
  spoke.position.set(0, Math.sin(angle) * 0.075, Math.cos(angle) * 0.075);
  spoke.rotation.x = angle + (i % 2 === 0 ? 0.15 : -0.15);
  rWheelGroup.add(spoke);
}

bikeGroup.add(rWheelGroup);

// ═══════════════════════════════════════
// FOOTPEGS — Wide MX pegs
// ═══════════════════════════════════════

const pegL = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.04, 6), chromeMat.clone());
pegL.rotation.z = Math.PI / 2;
pegL.position.set(0.065, -0.08, -0.02);
bikeGroup.add(pegL);
const pegR = pegL.clone();
pegR.position.x = -0.065;
bikeGroup.add(pegR);

// Peg mounts
const pegMountL = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.025, 0.015), frameMat.clone());
pegMountL.position.set(0.045, -0.07, -0.02);
bikeGroup.add(pegMountL);
const pegMountR = pegMountL.clone();
pegMountR.position.x = -0.045;
bikeGroup.add(pegMountR);

// ═══════════════════════════════════════
// KICK STARTER
// ═══════════════════════════════════════

const kickStart = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.07, 6), chromeMat.clone());
kickStart.rotation.z = 0.7;
kickStart.position.set(0.07, -0.06, -0.06);
bikeGroup.add(kickStart);

// ═══════════════════════════════════════
// SKID PLATE (engine guard)
// ═══════════════════════════════════════

const skidPlate = new THREE.Mesh(
  new THREE.BoxGeometry(0.09, 0.01, 0.16),
  new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6, roughness: 0.4 }),
);
skidPlate.position.set(0, -0.1, 0.02);
bikeGroup.add(skidPlate);

// ═══════════════════════════════════════
// Configure group
// ═══════════════════════════════════════

bikeGroup.visible = false;
bikeGroup.scale.setScalar(1.3);
bikeGroup.renderOrder = 1;
// YXZ order: heading (Y) in world, tilt (X) and lean (Z) in bike's local frame
bikeGroup.rotation.order = 'YXZ';

export function resetBike(): void {
  mxBike.t = 0; mxBike.lat = 0; mxBike.speed = 0; mxBike.angle = 0;
  mxBike.airborne = false; mxBike.jumpVel = 0; mxBike.hOff = 0;
  mxBike.lean = 0; mxBike.driftFactor = 0; mxBike.suspBob = 0;
  mxBike.wheelie = false; mxBike.wheelieBalance = 0; mxBike.wheelieTime = 0;
}
