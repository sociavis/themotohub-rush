import * as THREE from 'three';
import { T, tC } from '../game/themes';
import { upgrades, BIKE_COLORS } from '../game/shop';

// ── Bike Preview for Shop ──
let previewRenderer: THREE.WebGLRenderer | null = null;
let previewScene: THREE.Scene | null = null;
let previewCamera: THREE.PerspectiveCamera | null = null;
let previewBikeGroup: THREE.Group | null = null;
let previewAnimId: number | null = null;
let previewContainer: HTMLElement | null = null;

// Part meshes for highlighting
let pFrame: THREE.Mesh;
let pSeat: THREE.Mesh;
let pFork: THREE.Mesh;
let pBars: THREE.Mesh;
let pFWheel: THREE.Mesh;
let pRWheel: THREE.Mesh;
let pFWheelGroup: THREE.Group;
let pRWheelGroup: THREE.Group;

// Materials
let bodyMat: THREE.MeshStandardMaterial;
let tireMat: THREE.MeshStandardMaterial;
let chromeMat: THREE.MeshStandardMaterial;
let forkMat: THREE.MeshStandardMaterial;
let engineMat: THREE.MeshStandardMaterial;

// Engine block mesh
let pEngine: THREE.Mesh;
// Suspension meshes
let pForkUpperL: THREE.Mesh;
let pForkUpperR: THREE.Mesh;
let pRearShock: THREE.Mesh;

// Current highlight and preview state
let highlightedPart: string | null = null;
let previewColor: number[] | null = null;

// Body-colored parts tracked for color preview
let bodyParts: THREE.Mesh[] = [];

// Upgrade-level colors for parts
const TIRE_COLORS: [number, number, number][] = [
  [40, 40, 40],       // stock - dark grey
  [50, 45, 35],       // grip compound - brownish
  [30, 30, 35],       // racing slicks - dark blue-grey
  [25, 25, 30],       // pro grip - near black
];

const ENGINE_COLORS: [number, number, number][] = [
  [80, 80, 85],       // stock - grey
  [100, 85, 60],      // 250cc - bronze
  [140, 130, 110],    // 350cc - silver-gold
  [180, 160, 60],     // 450cc race - gold
];

const GEARBOX_COLORS: [number, number, number][] = [
  [70, 70, 75],       // stock
  [60, 80, 100],      // close ratio - blue steel
  [80, 60, 100],      // racing - purple steel
  [100, 40, 40],      // pro shift - red
];

const SUSPENSION_COLORS: [number, number, number][] = [
  [150, 150, 155],    // stock - silver
  [200, 180, 50],     // sport - gold
  [50, 180, 220],     // pro - cyan
  [255, 60, 30],      // factory race - red-orange
];

function addBody(group: THREE.Group, geo: THREE.BufferGeometry, pos: [number, number, number], rot?: [number, number, number]): THREE.Mesh {
  const m = new THREE.Mesh(geo, bodyMat.clone());
  m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  group.add(m);
  bodyParts.push(m);
  return m;
}

function buildPreviewBike(): THREE.Group {
  const group = new THREE.Group();
  bodyParts = [];

  const bikeCol = BIKE_COLORS[upgrades.bikeColor].color;
  bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(bikeCol[0] / 255, bikeCol[1] / 255, bikeCol[2] / 255),
    emissive: new THREE.Color(bikeCol[0] / 255, bikeCol[1] / 255, bikeCol[2] / 255),
    emissiveIntensity: 0.5, metalness: 0.7, roughness: 0.3,
  });

  const tc = TIRE_COLORS[upgrades.tires];
  tireMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(tc[0] / 255, tc[1] / 255, tc[2] / 255),
    metalness: 0.2, roughness: 0.8,
  });

  chromeMat = new THREE.MeshStandardMaterial({
    color: 0xcccccc, metalness: 0.9, roughness: 0.1,
  });

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x888888, metalness: 0.8, roughness: 0.2,
  });

  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x222222, metalness: 0.3, roughness: 0.8,
  });

  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xeeeeee, roughness: 0.6, metalness: 0.1,
  });

  const fc = SUSPENSION_COLORS[upgrades.suspension];
  forkMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(fc[0] / 255, fc[1] / 255, fc[2] / 255),
    metalness: 0.8, roughness: 0.2,
  });

  const ec = ENGINE_COLORS[upgrades.engine];
  engineMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(ec[0] / 255, ec[1] / 255, ec[2] / 255),
    emissive: new THREE.Color(ec[0] / 255, ec[1] / 255, ec[2] / 255),
    emissiveIntensity: 0.15, metalness: 0.8, roughness: 0.3,
  });

  // ── Main Frame (cradle) ──
  const topTube = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.38, 6), frameMat.clone());
  topTube.rotation.x = -0.25;
  topTube.position.set(0, 0.16, 0.06);
  group.add(topTube);

  const downTube = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.32, 6), frameMat.clone());
  downTube.rotation.x = 0.6;
  downTube.position.set(0, 0.04, 0.15);
  group.add(downTube);

  const lowerCradle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.22, 6), frameMat.clone());
  lowerCradle.rotation.x = Math.PI / 2;
  lowerCradle.position.set(0, -0.08, 0);
  group.add(lowerCradle);

  const seatRail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 6), frameMat.clone());
  seatRail.rotation.x = -0.35;
  seatRail.position.set(0, 0.18, -0.1);
  group.add(seatRail);

  // ── Engine Block ──
  pEngine = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.16), engineMat.clone());
  pEngine.position.set(0, -0.01, 0.04);
  group.add(pEngine);

  const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.08, 8), engineMat.clone());
  cylinder.rotation.x = -0.8;
  cylinder.position.set(0, 0.06, 0.1);
  cylinder.userData.part = 'engine';
  group.add(cylinder);

  // ── Gearbox ──
  const gc = GEARBOX_COLORS[upgrades.gearbox];
  const gearMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(gc[0] / 255, gc[1] / 255, gc[2] / 255),
    metalness: 0.7, roughness: 0.4,
  });
  const pGearbox = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.12), gearMat);
  pGearbox.position.set(0, -0.05, -0.02);
  pGearbox.userData.part = 'gearbox';
  group.add(pGearbox);

  // ── Fuel Tank (body colored) ──
  pFrame = addBody(group, new THREE.BoxGeometry(0.14, 0.08, 0.2), [0, 0.2, 0.08]);
  // Tank sides
  addBody(group, new THREE.BoxGeometry(0.01, 0.1, 0.18), [0.07, 0.19, 0.08], [0, 0, 0.15]);
  addBody(group, new THREE.BoxGeometry(0.01, 0.1, 0.18), [-0.07, 0.19, 0.08], [0, 0, -0.15]);

  // ── Seat (body colored, upswept) ──
  pSeat = addBody(group, new THREE.BoxGeometry(0.11, 0.035, 0.28), [0, 0.2, -0.12], [0.1, 0, 0]);

  // ── Rear Fender (body colored) ──
  addBody(group, new THREE.BoxGeometry(0.1, 0.02, 0.16), [0, 0.22, -0.26], [0.35, 0, 0]);

  // ── Front Forks (USD inverted) ──
  pForkUpperL = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.28, 8), forkMat.clone());
  pForkUpperL.rotation.x = -0.38;
  pForkUpperL.position.set(0.04, 0.1, 0.3);
  group.add(pForkUpperL);
  const forkLowerL = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.18, 8), darkMat.clone());
  forkLowerL.rotation.x = -0.38;
  forkLowerL.position.set(0.04, -0.06, 0.37);
  group.add(forkLowerL);
  pForkUpperR = pForkUpperL.clone();
  pForkUpperR.position.x = -0.04;
  group.add(pForkUpperR);
  const forkLowerR = forkLowerL.clone();
  forkLowerR.position.x = -0.04;
  group.add(forkLowerR);

  // Alias for highlighting
  pFork = pForkUpperL;

  // ── Front Fender (body colored) ──
  addBody(group, new THREE.BoxGeometry(0.06, 0.015, 0.14), [0, 0.06, 0.36], [-0.35, 0, 0]);

  // ── Handlebars ──
  const barL = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 6), darkMat.clone());
  barL.rotation.z = Math.PI / 2;
  barL.position.set(0.08, 0.28, 0.24);
  group.add(barL);
  const barR = barL.clone();
  barR.position.x = -0.08;
  group.add(barR);
  // Crossbar
  pBars = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 6), chromeMat.clone());
  pBars.rotation.z = Math.PI / 2;
  pBars.position.set(0, 0.3, 0.24);
  group.add(pBars);
  // Bar pad (body colored)
  addBody(group, new THREE.BoxGeometry(0.04, 0.02, 0.025), [0, 0.3, 0.24]);
  // Grips
  const gripL = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.04, 6), darkMat.clone());
  gripL.rotation.z = Math.PI / 2;
  gripL.position.set(0.12, 0.28, 0.24);
  group.add(gripL);
  const gripR = gripL.clone();
  gripR.position.x = -0.12;
  group.add(gripR);

  // ── Front Number Plate ──
  const numberPlate = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.015), whiteMat.clone());
  numberPlate.position.set(0, 0.22, 0.34);
  numberPlate.rotation.x = -0.2;
  group.add(numberPlate);

  // ── Side Plates (body colored) ──
  addBody(group, new THREE.BoxGeometry(0.01, 0.08, 0.14), [0.065, 0.12, -0.06]);
  addBody(group, new THREE.BoxGeometry(0.01, 0.08, 0.14), [-0.065, 0.12, -0.06]);

  // ── Rear Swingarm ──
  const swingarmL = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 6), frameMat.clone());
  swingarmL.rotation.x = Math.PI / 2;
  swingarmL.position.set(0.04, -0.06, -0.18);
  swingarmL.rotation.z = 0.08;
  group.add(swingarmL);
  const swingarmR = swingarmL.clone();
  swingarmR.position.x = -0.04;
  swingarmR.rotation.z = -0.08;
  group.add(swingarmR);

  // ── Rear Shock ──
  pRearShock = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.2, 6), forkMat.clone());
  pRearShock.rotation.x = -0.3;
  pRearShock.position.set(0, 0.04, -0.18);
  group.add(pRearShock);

  // ── Exhaust ──
  const exhaust1 = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.015, 0.2, 8), chromeMat.clone());
  exhaust1.rotation.x = 0.3;
  exhaust1.position.set(0.06, -0.04, 0.0);
  group.add(exhaust1);
  const silencer = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.022, 0.14, 8), new THREE.MeshStandardMaterial({
    color: 0x444444, metalness: 0.5, roughness: 0.4,
  }));
  silencer.rotation.x = 0.15;
  silencer.position.set(0.06, -0.02, -0.16);
  group.add(silencer);

  // ── Chain ──
  const chain = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.008, 0.32), darkMat.clone());
  chain.position.set(0.03, -0.1, -0.12);
  group.add(chain);

  // ── Front Wheel ──
  pFWheelGroup = new THREE.Group();
  pFWheelGroup.position.set(0, -0.1, 0.44);
  const fTire = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 8, 20), tireMat.clone());
  fTire.rotation.y = Math.PI / 2;
  pFWheelGroup.add(fTire);
  const fHub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 12), chromeMat.clone());
  fHub.rotation.z = Math.PI / 2;
  pFWheelGroup.add(fHub);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.12, 4), chromeMat.clone());
    spoke.position.set(0, Math.sin(angle) * 0.08, Math.cos(angle) * 0.08);
    spoke.rotation.x = angle;
    pFWheelGroup.add(spoke);
  }
  pFWheel = fTire;
  group.add(pFWheelGroup);

  // ── Rear Wheel ──
  pRWheelGroup = new THREE.Group();
  pRWheelGroup.position.set(0, -0.1, -0.36);
  const rTire = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.045, 8, 18), tireMat.clone());
  rTire.rotation.y = Math.PI / 2;
  pRWheelGroup.add(rTire);
  const rHub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 12), chromeMat.clone());
  rHub.rotation.z = Math.PI / 2;
  pRWheelGroup.add(rHub);
  const sprocket = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.006, 6, 12), chromeMat.clone());
  sprocket.rotation.y = Math.PI / 2;
  sprocket.position.set(0.025, 0, 0);
  pRWheelGroup.add(sprocket);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.1, 4), chromeMat.clone());
    spoke.position.set(0, Math.sin(angle) * 0.07, Math.cos(angle) * 0.07);
    spoke.rotation.x = angle;
    pRWheelGroup.add(spoke);
  }
  pRWheel = rTire;
  group.add(pRWheelGroup);

  // ── Footpegs ──
  const pegL = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.03, 6), chromeMat.clone());
  pegL.rotation.z = Math.PI / 2;
  pegL.position.set(0.06, -0.08, -0.02);
  group.add(pegL);
  const pegR = pegL.clone();
  pegR.position.x = -0.06;
  group.add(pegR);

  group.scale.setScalar(2.2);
  return group;
}

export function initBikePreview(container: HTMLElement): void {
  previewContainer = container;

  // Create renderer
  previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  previewRenderer.setClearColor(0x000000, 0);
  previewRenderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(previewRenderer.domElement);

  // Scene
  previewScene = new THREE.Scene();

  // Camera
  previewCamera = new THREE.PerspectiveCamera(35, container.clientWidth / container.clientHeight, 0.1, 100);
  previewCamera.position.set(1.5, 1.0, 1.8);
  previewCamera.lookAt(0, 0.15, 0);

  // Lighting
  const ambLight = new THREE.AmbientLight(0x404050, 1.2);
  previewScene.add(ambLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
  dirLight.position.set(3, 4, 2);
  previewScene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0x4466ff, 0.5);
  fillLight.position.set(-2, 1, -1);
  previewScene.add(fillLight);

  const rimLight = new THREE.PointLight(0xff6600, 1, 8);
  rimLight.position.set(-1, 2, -2);
  previewScene.add(rimLight);

  // Ground plane (subtle reflection)
  const groundGeo = new THREE.PlaneGeometry(6, 6);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x111118,
    metalness: 0.9,
    roughness: 0.3,
    transparent: true,
    opacity: 0.6,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.25;
  previewScene.add(ground);

  // Build bike
  previewBikeGroup = buildPreviewBike();
  previewScene.add(previewBikeGroup);

  // Start animation
  const startTime = performance.now();
  function animate(): void {
    previewAnimId = requestAnimationFrame(animate);
    if (!previewRenderer || !previewScene || !previewCamera || !previewBikeGroup) return;

    const t = (performance.now() - startTime) / 1000;
    previewBikeGroup.rotation.y = t * 0.4; // slow rotation

    // Subtle hover bob
    previewBikeGroup.position.y = Math.sin(t * 1.5) * 0.01;

    previewRenderer.render(previewScene, previewCamera);
  }
  animate();
}

export function destroyBikePreview(): void {
  if (previewAnimId !== null) cancelAnimationFrame(previewAnimId);
  if (previewRenderer) {
    previewRenderer.dispose();
    if (previewRenderer.domElement.parentElement) {
      previewRenderer.domElement.parentElement.removeChild(previewRenderer.domElement);
    }
  }
  previewRenderer = null;
  previewScene = null;
  previewCamera = null;
  previewBikeGroup = null;
  previewAnimId = null;
  previewContainer = null;
  highlightedPart = null;
  previewColor = null;
  bodyParts = [];
}

export function highlightPart(part: string | null): void {
  highlightedPart = part;
  if (!previewBikeGroup) return;

  // Reset all emissive intensities
  resetHighlights();

  if (!part) return;

  const highlightColor = new THREE.Color(1, 1, 1);
  const intensity = 0.6;

  if (part === 'tires') {
    setEmissive(pFWheel, highlightColor, intensity);
    setEmissive(pRWheel, highlightColor, intensity);
    pFWheelGroup.children.forEach(c => { if (c !== pFWheel) setEmissive(c as THREE.Mesh, highlightColor, intensity); });
    pRWheelGroup.children.forEach(c => { if (c !== pRWheel) setEmissive(c as THREE.Mesh, highlightColor, intensity); });
  } else if (part === 'engine') {
    setEmissive(pEngine, highlightColor, intensity);
    // Also highlight cylinder head
    previewBikeGroup.children.forEach(c => {
      if ((c as any).userData?.part === 'engine') setEmissive(c as THREE.Mesh, highlightColor, intensity);
    });
  } else if (part === 'gearbox') {
    previewBikeGroup.children.forEach(c => {
      if ((c as any).userData?.part === 'gearbox') setEmissive(c as THREE.Mesh, highlightColor, intensity);
    });
  } else if (part === 'suspension') {
    setEmissive(pForkUpperL, highlightColor, intensity);
    setEmissive(pForkUpperR, highlightColor, intensity);
    setEmissive(pRearShock, highlightColor, intensity);
  }
}

export function previewBikeColor(color: number[] | null): void {
  previewColor = color;
  if (!previewBikeGroup) return;

  const col = color || BIKE_COLORS[upgrades.bikeColor].color;
  const c = new THREE.Color(col[0] / 255, col[1] / 255, col[2] / 255);

  for (const mesh of bodyParts) {
    (mesh.material as THREE.MeshStandardMaterial).color.copy(c);
    (mesh.material as THREE.MeshStandardMaterial).emissive.copy(c);
  }
}

export function refreshPreviewBike(): void {
  if (!previewScene || !previewBikeGroup) return;
  const rot = previewBikeGroup.rotation.y;
  previewScene.remove(previewBikeGroup);
  previewBikeGroup = buildPreviewBike();
  previewBikeGroup.rotation.y = rot;
  previewScene.add(previewBikeGroup);
}

function resetHighlights(): void {
  if (!previewBikeGroup) return;
  // Reset body parts
  for (const mesh of bodyParts) {
    (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5;
  }
  // Reset tires
  pFWheelGroup.children.forEach(c => {
    if ((c as THREE.Mesh).material) ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
  });
  pRWheelGroup.children.forEach(c => {
    if ((c as THREE.Mesh).material) ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
  });
  // Reset engine
  (pEngine.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15;
  previewBikeGroup.children.forEach(c => {
    if ((c as any).userData?.part === 'engine') {
      ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15;
    }
  });
  // Reset suspension
  (pForkUpperL.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
  (pForkUpperR.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
  (pRearShock.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
  // Reset gearbox
  previewBikeGroup.children.forEach(c => {
    if ((c as any).userData?.part === 'gearbox') {
      ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
    }
  });
}

function setEmissive(mesh: THREE.Mesh, color: THREE.Color, intensity: number): void {
  const mat = mesh.material as THREE.MeshStandardMaterial;
  if (mat && mat.emissive !== undefined) {
    mat.emissive = color;
    mat.emissiveIntensity = intensity;
  }
}
