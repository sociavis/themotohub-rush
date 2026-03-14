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
// Suspension meshes (front fork springs + rear shock)
let pForkSpringL: THREE.Mesh;
let pForkSpringR: THREE.Mesh;
let pRearShock: THREE.Mesh;

// Current highlight and preview state
let highlightedPart: string | null = null;
let previewColor: number[] | null = null;

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

function buildPreviewBike(): THREE.Group {
  const group = new THREE.Group();

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

  // Frame
  pFrame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.65), bodyMat.clone());
  pFrame.rotation.x = -0.08;
  pFrame.position.set(0, 0.12, 0.02);
  group.add(pFrame);

  // Seat
  pSeat = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.26), bodyMat.clone());
  pSeat.position.set(0, 0.22, -0.06);
  group.add(pSeat);

  // Front fork
  pFork = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 6), forkMat.clone());
  pFork.rotation.x = -0.35;
  pFork.position.set(0, 0.04, 0.32);
  group.add(pFork);

  // Fork springs (suspension visual)
  const springGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.2, 6);
  pForkSpringL = new THREE.Mesh(springGeo, forkMat.clone());
  pForkSpringL.position.set(0.035, 0.06, 0.34);
  pForkSpringL.rotation.x = -0.35;
  group.add(pForkSpringL);
  pForkSpringR = new THREE.Mesh(springGeo, forkMat.clone());
  pForkSpringR.position.set(-0.035, 0.06, 0.34);
  pForkSpringR.rotation.x = -0.35;
  group.add(pForkSpringR);

  // Rear shock
  pRearShock = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6), forkMat.clone());
  pRearShock.position.set(0, 0.06, -0.22);
  pRearShock.rotation.x = -0.3;
  group.add(pRearShock);

  // Handlebars
  pBars = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), chromeMat.clone());
  pBars.rotation.z = Math.PI / 2;
  pBars.position.set(0, 0.24, 0.28);
  group.add(pBars);

  // Engine block
  pEngine = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.15), engineMat.clone());
  pEngine.position.set(0, 0.04, 0.05);
  group.add(pEngine);

  // Gearbox (under engine, slightly behind)
  const gc = GEARBOX_COLORS[upgrades.gearbox];
  const gearMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(gc[0] / 255, gc[1] / 255, gc[2] / 255),
    metalness: 0.7, roughness: 0.4,
  });
  const pGearbox = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.12), gearMat);
  pGearbox.position.set(0, -0.01, -0.02);
  pGearbox.userData.part = 'gearbox';
  group.add(pGearbox);

  // Front wheel
  pFWheelGroup = new THREE.Group();
  pFWheelGroup.position.set(0, -0.04, 0.42);
  pFWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 16), tireMat.clone());
  pFWheel.rotation.z = Math.PI / 2;
  pFWheelGroup.add(pFWheel);
  // Tire tread ring
  const treadF = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.015, 6, 16), tireMat.clone());
  treadF.rotation.y = Math.PI / 2;
  pFWheelGroup.add(treadF);
  group.add(pFWheelGroup);

  // Rear wheel
  pRWheelGroup = new THREE.Group();
  pRWheelGroup.position.set(0, -0.04, -0.36);
  pRWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 16), tireMat.clone());
  pRWheel.rotation.z = Math.PI / 2;
  pRWheelGroup.add(pRWheel);
  const treadR = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.015, 6, 16), tireMat.clone());
  treadR.rotation.y = Math.PI / 2;
  pRWheelGroup.add(treadR);
  group.add(pRWheelGroup);

  // Exhaust pipe
  const exhaust = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.02, 0.3, 6),
    chromeMat.clone(),
  );
  exhaust.position.set(0.06, 0.0, -0.15);
  exhaust.rotation.x = -0.2;
  group.add(exhaust);

  // Number plate (front)
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.06, 0.01),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
  );
  plate.position.set(0, 0.2, 0.36);
  group.add(plate);

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
    // Highlight tread too
    pFWheelGroup.children.forEach(c => { if (c !== pFWheel) setEmissive(c as THREE.Mesh, highlightColor, intensity); });
    pRWheelGroup.children.forEach(c => { if (c !== pRWheel) setEmissive(c as THREE.Mesh, highlightColor, intensity); });
  } else if (part === 'engine') {
    setEmissive(pEngine, highlightColor, intensity);
  } else if (part === 'gearbox') {
    // Find gearbox mesh
    previewBikeGroup.children.forEach(c => {
      if ((c as any).userData?.part === 'gearbox') setEmissive(c as THREE.Mesh, highlightColor, intensity);
    });
  } else if (part === 'suspension') {
    setEmissive(pFork, highlightColor, intensity);
    setEmissive(pForkSpringL, highlightColor, intensity);
    setEmissive(pForkSpringR, highlightColor, intensity);
    setEmissive(pRearShock, highlightColor, intensity);
  }
}

export function previewBikeColor(color: number[] | null): void {
  previewColor = color;
  if (!previewBikeGroup) return;

  const col = color || BIKE_COLORS[upgrades.bikeColor].color;
  const c = new THREE.Color(col[0] / 255, col[1] / 255, col[2] / 255);

  (pFrame.material as THREE.MeshStandardMaterial).color.copy(c);
  (pFrame.material as THREE.MeshStandardMaterial).emissive.copy(c);
  (pSeat.material as THREE.MeshStandardMaterial).color.copy(c);
  (pSeat.material as THREE.MeshStandardMaterial).emissive.copy(c);
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
  (pFrame.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5;
  (pSeat.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5;
  // Reset tires
  (pFWheel.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
  (pRWheel.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
  pFWheelGroup.children.forEach(c => {
    if ((c as THREE.Mesh).material) ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
  });
  pRWheelGroup.children.forEach(c => {
    if ((c as THREE.Mesh).material) ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
  });
  // Reset engine
  (pEngine.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15;
  // Reset suspension
  (pFork.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
  (pForkSpringL.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
  (pForkSpringR.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
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
