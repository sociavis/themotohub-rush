import * as THREE from 'three';
import { T, tC } from './themes';

// ── Renderer ──
const canvas = document.getElementById('c3d') as HTMLCanvasElement;
export const R = new THREE.WebGLRenderer({ canvas, antialias: true });
R.setPixelRatio(Math.min(devicePixelRatio, 2));
R.setSize(innerWidth, innerHeight);
R.setClearColor(0x060a10);
R.toneMapping = THREE.ACESFilmicToneMapping;
R.toneMappingExposure = 1.4;

// ── Scene ──
export const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x060a10, 0.006);

// ── Camera ──
export const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 600);
camera.position.set(0, 18, 14);
camera.lookAt(0, 0, 0);

export const camTargets = [{ px: 0, py: 20, pz: 14, lx: 0, ly: 0, lz: 0 }];
export const cam = { px: 0, py: 18, pz: 14, lx: 0, ly: 0, lz: 0 };

// ── Resize ──
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  R.setSize(innerWidth, innerHeight);
});

// ── Lights ──
export const ambL = new THREE.AmbientLight(0x111122, 0.4);
scene.add(ambL);
export const dirL = new THREE.DirectionalLight(0xffffff, 0.3);
dirL.position.set(5, 15, 5);
scene.add(dirL);
export const ptL = new THREE.PointLight(0xff6400, 3, 50);
ptL.position.set(0, 3, 0);
scene.add(ptL);
export const ptL2 = new THREE.PointLight(0x00e5ff, 1.5, 40);
ptL2.position.set(-6, 6, -6);
scene.add(ptL2);

// ── Grid ──
const GRID_SIZE = 80;
const GRID_DIV = 30;
const GRID_STEP = GRID_SIZE / GRID_DIV;
const gridPts: number[] = [];

for (let i = 0; i <= GRID_DIV; i++) {
  const z = -GRID_SIZE / 2 + i * GRID_STEP;
  gridPts.push(-GRID_SIZE / 2, 0, z, GRID_SIZE / 2, 0, z);
}
for (let i = 0; i <= GRID_DIV; i++) {
  const x = -GRID_SIZE / 2 + i * GRID_STEP;
  gridPts.push(x, 0, -GRID_SIZE / 2, x, 0, GRID_SIZE / 2);
}

const gridGeo = new THREE.BufferGeometry();
gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPts, 3));
export const gridMat = new THREE.LineBasicMaterial({
  color: tC(T().grid),
  transparent: true,
  opacity: 0.1,
});
export let gridBaseOpacity = 0.12;
export const grid = new THREE.LineSegments(gridGeo, gridMat);
grid.position.y = -2;
scene.add(grid);

const gV = gridGeo.attributes.position as THREE.BufferAttribute;
const gOrig = new Float32Array(gV.array as Float32Array);

export function warpGrid(t: number, cx: number, cz: number, str: number): void {
  const arr = gV.array as Float32Array;
  for (let i = 0; i < arr.length; i += 3) {
    const ox = gOrig[i], oz = gOrig[i + 2];
    const d = Math.hypot(ox - cx, oz - cz);
    const pull = d < 18 ? Math.pow(1 - d / 18, 2) * str : 0;
    const wave = Math.sin(d * 0.3 - t * 2) * 0.05;
    arr[i + 1] = gOrig[i + 1] - pull + wave;
    arr[i] = gOrig[i];
    arr[i + 2] = gOrig[i + 2];
  }
  gV.needsUpdate = true;
}
