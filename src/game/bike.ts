import * as THREE from 'three';
import { T, tC } from './themes';
import type { BikeState } from './types';

// ── Bike State ──
export const mxBike: BikeState = {
  t: 0, lat: 0, speed: 0, maxSpeed: 16, accel: 12, brake: 8,
  turnSpeed: 3.8, angle: 0, airborne: false, jumpVel: 0, hOff: 0,
  lean: 0, driftFactor: 0, pos: new THREE.Vector3(), suspBob: 0,
};

// ── Bike Model ──
export const bikeGroup = new THREE.Group();

const bikeMat = new THREE.MeshStandardMaterial({
  color: tC(T().primary), emissive: tC(T().primary),
  emissiveIntensity: 0.7, metalness: 0.7, roughness: 0.3,
});
const bikeWhiteMat = new THREE.MeshBasicMaterial({
  color: 0xffffff, transparent: true, opacity: 0.6,
});

// Frame
export const frame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.65), bikeMat.clone());
frame.rotation.x = -0.08;
frame.position.set(0, 0.12, 0.02);
bikeGroup.add(frame);

// Seat
export const seat = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.26), bikeMat.clone());
seat.position.set(0, 0.22, -0.06);
bikeGroup.add(seat);

// Front fork
const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 6), bikeWhiteMat.clone());
fork.rotation.x = -0.35;
fork.position.set(0, 0.04, 0.32);
bikeGroup.add(fork);

// Handlebars
const bars = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), bikeWhiteMat.clone());
bars.rotation.z = Math.PI / 2;
bars.position.set(0, 0.24, 0.28);
bikeGroup.add(bars);

// Front wheel
export const fWheelGroup = new THREE.Group();
fWheelGroup.position.set(0, -0.04, 0.42);
const fWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 14), bikeWhiteMat.clone());
fWheel.rotation.z = Math.PI / 2;
fWheelGroup.add(fWheel);
bikeGroup.add(fWheelGroup);

// Rear wheel
export const rWheelGroup = new THREE.Group();
rWheelGroup.position.set(0, -0.04, -0.36);
const rWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 14), bikeWhiteMat.clone());
rWheel.rotation.z = Math.PI / 2;
rWheelGroup.add(rWheel);
bikeGroup.add(rWheelGroup);

bikeGroup.visible = false;
bikeGroup.scale.setScalar(1.3);
bikeGroup.renderOrder = 1;

export function resetBike(): void {
  mxBike.t = 0; mxBike.lat = 0; mxBike.speed = 0; mxBike.angle = 0;
  mxBike.airborne = false; mxBike.jumpVel = 0; mxBike.hOff = 0;
  mxBike.lean = 0; mxBike.driftFactor = 0; mxBike.suspBob = 0;
}
