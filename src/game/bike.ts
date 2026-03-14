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
export const bikeGroup = new THREE.Group();

// Materials
const bodyMat = new THREE.MeshStandardMaterial({
  color: tC(T().primary), emissive: tC(T().primary),
  emissiveIntensity: 0.7, metalness: 0.7, roughness: 0.3,
});
const frameMat = new THREE.MeshStandardMaterial({
  color: 0x888888, metalness: 0.8, roughness: 0.2,
});
const darkMat = new THREE.MeshStandardMaterial({
  color: 0x222222, metalness: 0.3, roughness: 0.8,
});
const chromeMat = new THREE.MeshStandardMaterial({
  color: 0xcccccc, metalness: 0.9, roughness: 0.1,
});
const tireMat = new THREE.MeshStandardMaterial({
  color: 0x1a1a1a, metalness: 0.15, roughness: 0.9,
});
const whiteMat = new THREE.MeshStandardMaterial({
  color: 0xeeeeee, roughness: 0.6, metalness: 0.1,
});

// ── Main Frame (cradle frame with downtube) ──
// Top tube — angled down from headstock to seat area
const topTube = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.38, 6), frameMat.clone());
topTube.rotation.x = -0.25;
topTube.position.set(0, 0.16, 0.06);
bikeGroup.add(topTube);

// Down tube — from headstock down to engine area
const downTube = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.32, 6), frameMat.clone());
downTube.rotation.x = 0.6;
downTube.position.set(0, 0.04, 0.15);
bikeGroup.add(downTube);

// Lower cradle — under engine
const lowerCradle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.22, 6), frameMat.clone());
lowerCradle.rotation.x = Math.PI / 2;
lowerCradle.position.set(0, -0.08, 0);
bikeGroup.add(lowerCradle);

// Seat rail tube
const seatRail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 6), frameMat.clone());
seatRail.rotation.x = -0.35;
seatRail.position.set(0, 0.18, -0.1);
bikeGroup.add(seatRail);

// ── Engine Block ──
const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.16), new THREE.MeshStandardMaterial({
  color: 0x666666, metalness: 0.7, roughness: 0.4,
}));
engineBlock.position.set(0, -0.01, 0.04);
bikeGroup.add(engineBlock);

// Engine cylinder head (angled forward)
const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.08, 8), new THREE.MeshStandardMaterial({
  color: 0x777777, metalness: 0.6, roughness: 0.3,
}));
cylinder.rotation.x = -0.8;
cylinder.position.set(0, 0.06, 0.1);
bikeGroup.add(cylinder);

// ── Fuel Tank (colored body part) ──
// Main tank body — wider, sits on top of frame
export const frame = new THREE.Mesh(
  new THREE.BoxGeometry(0.14, 0.08, 0.2),
  bodyMat.clone(),
);
frame.position.set(0, 0.2, 0.08);
bikeGroup.add(frame);

// Tank sides (give it the angular MX shape)
const tankSideL = new THREE.Mesh(
  new THREE.BoxGeometry(0.01, 0.1, 0.18),
  bodyMat.clone(),
);
tankSideL.position.set(0.07, 0.19, 0.08);
tankSideL.rotation.z = 0.15;
bikeGroup.add(tankSideL);
const tankSideR = tankSideL.clone();
tankSideR.position.x = -0.07;
tankSideR.rotation.z = -0.15;
bikeGroup.add(tankSideR);

// ── Seat (colored body part — upswept rear) ──
export const seat = new THREE.Mesh(
  new THREE.BoxGeometry(0.11, 0.035, 0.28),
  bodyMat.clone(),
);
seat.position.set(0, 0.2, -0.12);
seat.rotation.x = 0.1; // slight upward angle at rear
bikeGroup.add(seat);

// ── Rear Fender (colored, sweeps up) ──
const rearFender = new THREE.Mesh(
  new THREE.BoxGeometry(0.1, 0.02, 0.16),
  bodyMat.clone(),
);
rearFender.position.set(0, 0.22, -0.26);
rearFender.rotation.x = 0.35;
bikeGroup.add(rearFender);

// ── Front Forks (USD inverted — thick at top, thin at bottom) ──
// Left fork upper (thick — gold/chrome)
const forkUpperL = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.28, 8), chromeMat.clone());
forkUpperL.rotation.x = -0.38;
forkUpperL.position.set(0.04, 0.1, 0.3);
bikeGroup.add(forkUpperL);
// Left fork lower (thinner — dark)
const forkLowerL = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.18, 8), darkMat.clone());
forkLowerL.rotation.x = -0.38;
forkLowerL.position.set(0.04, -0.06, 0.37);
bikeGroup.add(forkLowerL);
// Right fork upper
const forkUpperR = forkUpperL.clone();
forkUpperR.position.x = -0.04;
bikeGroup.add(forkUpperR);
// Right fork lower
const forkLowerR = forkLowerL.clone();
forkLowerR.position.x = -0.04;
bikeGroup.add(forkLowerR);

// ── Front Fender (colored — between forks) ──
const frontFender = new THREE.Mesh(
  new THREE.BoxGeometry(0.06, 0.015, 0.14),
  bodyMat.clone(),
);
frontFender.rotation.x = -0.35;
frontFender.position.set(0, 0.06, 0.36);
bikeGroup.add(frontFender);

// ── Handlebars with crossbar ──
const barL = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 6), darkMat.clone());
barL.rotation.z = Math.PI / 2;
barL.position.set(0.08, 0.28, 0.24);
bikeGroup.add(barL);
const barR = barL.clone();
barR.position.x = -0.08;
bikeGroup.add(barR);
// Crossbar
const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 6), chromeMat.clone());
crossbar.rotation.z = Math.PI / 2;
crossbar.position.set(0, 0.3, 0.24);
bikeGroup.add(crossbar);
// Bar pad (center cushion)
const barPad = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.025), bodyMat.clone());
barPad.position.set(0, 0.3, 0.24);
bikeGroup.add(barPad);
// Grips
const gripL = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.04, 6), darkMat.clone());
gripL.rotation.z = Math.PI / 2;
gripL.position.set(0.12, 0.28, 0.24);
bikeGroup.add(gripL);
const gripR = gripL.clone();
gripR.position.x = -0.12;
bikeGroup.add(gripR);

// ── Front Number Plate (white) ──
const numberPlate = new THREE.Mesh(
  new THREE.BoxGeometry(0.1, 0.08, 0.015),
  whiteMat.clone(),
);
numberPlate.position.set(0, 0.22, 0.34);
numberPlate.rotation.x = -0.2;
bikeGroup.add(numberPlate);

// ── Side Plates (colored) ──
const sidePlateL = new THREE.Mesh(
  new THREE.BoxGeometry(0.01, 0.08, 0.14),
  bodyMat.clone(),
);
sidePlateL.position.set(0.065, 0.12, -0.06);
bikeGroup.add(sidePlateL);
const sidePlateR = sidePlateL.clone();
sidePlateR.position.x = -0.065;
bikeGroup.add(sidePlateR);

// ── Rear Swingarm ──
const swingarmL = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 6), frameMat.clone());
swingarmL.rotation.x = Math.PI / 2;
swingarmL.position.set(0.04, -0.06, -0.18);
swingarmL.rotation.z = 0.08;
bikeGroup.add(swingarmL);
const swingarmR = swingarmL.clone();
swingarmR.position.x = -0.04;
swingarmR.rotation.z = -0.08;
bikeGroup.add(swingarmR);

// ── Rear Shock ──
const rearShock = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.2, 6), chromeMat.clone());
rearShock.rotation.x = -0.3;
rearShock.position.set(0, 0.04, -0.18);
bikeGroup.add(rearShock);

// ── Exhaust Pipe ──
const exhaust1 = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.015, 0.2, 8), chromeMat.clone());
exhaust1.rotation.x = 0.3;
exhaust1.position.set(0.06, -0.04, 0.0);
bikeGroup.add(exhaust1);
// Silencer (thicker section)
const silencer = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.022, 0.14, 8), new THREE.MeshStandardMaterial({
  color: 0x444444, metalness: 0.5, roughness: 0.4,
}));
silencer.rotation.x = 0.15;
silencer.position.set(0.06, -0.02, -0.16);
bikeGroup.add(silencer);

// ── Chain (simple visual) ──
const chain = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.008, 0.32), darkMat.clone());
chain.position.set(0.03, -0.1, -0.12);
bikeGroup.add(chain);

// ── Front Wheel (larger — 21" MX style) ──
export const fWheelGroup = new THREE.Group();
fWheelGroup.position.set(0, -0.1, 0.44);

// Tire (torus for knobby look)
const fTire = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 8, 20), tireMat.clone());
fTire.rotation.y = Math.PI / 2;
fWheelGroup.add(fTire);
// Hub
const fHub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 12), chromeMat.clone());
fHub.rotation.z = Math.PI / 2;
fWheelGroup.add(fHub);
// Spokes (simple radial lines)
for (let i = 0; i < 8; i++) {
  const angle = (i / 8) * Math.PI * 2;
  const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.12, 4), chromeMat.clone());
  spoke.position.set(0, Math.sin(angle) * 0.08, Math.cos(angle) * 0.08);
  spoke.rotation.x = angle;
  fWheelGroup.add(spoke);
}
bikeGroup.add(fWheelGroup);

// ── Rear Wheel (smaller — 19" MX style) ──
export const rWheelGroup = new THREE.Group();
rWheelGroup.position.set(0, -0.1, -0.36);

const rTire = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.045, 8, 18), tireMat.clone());
rTire.rotation.y = Math.PI / 2;
rWheelGroup.add(rTire);
const rHub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 12), chromeMat.clone());
rHub.rotation.z = Math.PI / 2;
rWheelGroup.add(rHub);
// Rear sprocket
const sprocket = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.006, 6, 12), chromeMat.clone());
sprocket.rotation.y = Math.PI / 2;
sprocket.position.set(0.025, 0, 0);
rWheelGroup.add(sprocket);
// Spokes
for (let i = 0; i < 8; i++) {
  const angle = (i / 8) * Math.PI * 2;
  const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.1, 4), chromeMat.clone());
  spoke.position.set(0, Math.sin(angle) * 0.07, Math.cos(angle) * 0.07);
  spoke.rotation.x = angle;
  rWheelGroup.add(spoke);
}
bikeGroup.add(rWheelGroup);

// ── Footpegs ──
const pegL = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.03, 6), chromeMat.clone());
pegL.rotation.z = Math.PI / 2;
pegL.position.set(0.06, -0.08, -0.02);
bikeGroup.add(pegL);
const pegR = pegL.clone();
pegR.position.x = -0.06;
bikeGroup.add(pegR);

// ── Kick starter ──
const kickStart = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.06, 6), chromeMat.clone());
kickStart.rotation.z = 0.6;
kickStart.position.set(0.065, -0.06, -0.06);
bikeGroup.add(kickStart);

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
