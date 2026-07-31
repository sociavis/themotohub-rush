import * as THREE from 'three';
import { upgrades, BIKE_COLORS } from '../game/shop';
import { createBikeModel, type BikeRefs, type BikePart } from '../game/bike';
import { loadGlbBike, cloneGlbBike, type GlbBikeRig } from '../game/bike-glb';

// ── Garage 3D preview — studio turntable using the shared bike factory ──

let pR: THREE.WebGLRenderer | null = null;
let pScene: THREE.Scene | null = null;
let pCam: THREE.PerspectiveCamera | null = null;
let pBike: BikeRefs | null = null;
let rafId = 0;

let highlightedPart: BikePart | null = null;
let previewColor: THREE.Color | null = null;
let pGlb: GlbBikeRig | null = null;

function currentColor(): THREE.Color {
  const c = BIKE_COLORS[upgrades.bikeColor].color;
  return new THREE.Color(c[0] / 255, c[1] / 255, c[2] / 255);
}

function applyTiers(): void {
  if (!pGlb) return;
  pGlb.setPartLevel('tires', upgrades.tires);
  pGlb.setPartLevel('engine', upgrades.engine);
  pGlb.setPartLevel('gearbox', upgrades.gearbox);
  pGlb.setPartLevel('suspension', upgrades.suspension);
}

export function initBikePreview(el: HTMLElement): void {
  destroyBikePreview();
  const w = el.clientWidth || 400;
  const h = el.clientHeight || 220;

  pR = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  pR.setPixelRatio(Math.min(devicePixelRatio, 2));
  pR.setSize(w, h);
  pR.toneMapping = THREE.ACESFilmicToneMapping;
  pR.toneMappingExposure = 1.1;
  pR.shadowMap.enabled = true;
  pR.shadowMap.type = THREE.PCFSoftShadowMap;
  el.appendChild(pR.domElement);

  pScene = new THREE.Scene();

  pCam = new THREE.PerspectiveCamera(38, w / h, 0.05, 40);
  pCam.position.set(1.5, 0.75, 1.9);
  pCam.lookAt(0, 0.12, 0);

  // studio lights
  const key = new THREE.DirectionalLight(0xfff2e0, 2.6);
  key.position.set(2.5, 3.5, 2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -1.5; key.shadow.camera.right = 1.5;
  key.shadow.camera.top = 1.5; key.shadow.camera.bottom = -1.5;
  pScene.add(key);
  const rim = new THREE.DirectionalLight(0x9db8e8, 1.2);
  rim.position.set(-2.5, 1.5, -2.5);
  pScene.add(rim);
  pScene.add(new THREE.HemisphereLight(0x8a92a0, 0x3a3630, 0.9));

  // floor disc
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(1.4, 36),
    new THREE.MeshStandardMaterial({ color: 0x24211d, roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.36;
  floor.receiveShadow = true;
  pScene.add(floor);

  pBike = createBikeModel(previewColor ?? currentColor(), '7');
  pScene.add(pBike.group);
  pBike.group.position.y = -0.01;
  // Hero GLB (CRF450) replaces the procedural model once loaded
  pGlb = null;
  loadGlbBike().then(rig => {
    if (!rig || !pScene || !pBike) return;
    pGlb = cloneGlbBike();
    if (!pGlb) return;
    pBike.group.visible = false;
    pGlb.root.position.y = -0.01;
    pGlb.tintMats.forEach(m => m.color.copy(previewColor ?? currentColor()));
    applyTiers();
    pScene.add(pGlb.root);
  });

  const t0 = performance.now();
  const tick = (): void => {
    rafId = requestAnimationFrame(tick);
    if (!pR || !pScene || !pCam || !pBike) return;
    const t = (performance.now() - t0) / 1000;
    pBike.group.rotation.y = t * 0.55;
    if (pGlb) { pGlb.root.rotation.y = t * 0.55; pGlb.spin(0.02); }
    // highlight pulse
    if (highlightedPart) {
      const glow = (Math.sin(t * 6) + 1) * 0.25 + 0.15;
      if (pGlb && highlightedPart !== 'body') {
        for (const mat of pGlb.partMats[highlightedPart]) {
          mat.emissive.setRGB(0.95, 0.2, 0.22);
          mat.emissiveIntensity = glow;
        }
      } else {
        for (const m of pBike.partMap[highlightedPart]) {
          const mat = m.material as THREE.MeshStandardMaterial;
          mat.emissive.setRGB(1, 0.45, 0.1);
          mat.emissiveIntensity = glow;
        }
      }
    }
    pR.render(pScene, pCam);
  };
  tick();
}

export function destroyBikePreview(): void {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  if (pR) {
    pR.dispose();
    if (pR.domElement.parentElement) pR.domElement.parentElement.removeChild(pR.domElement);
  }
  pR = null; pScene = null; pCam = null; pBike = null; pGlb = null;
  highlightedPart = null;
}

function clearEmissive(): void {
  if (pGlb) {
    (Object.keys(pGlb.partMats) as (keyof typeof pGlb.partMats)[]).forEach(k => {
      for (const mat of pGlb!.partMats[k]) {
        if (mat.emissiveIntensity !== 0) {
          mat.emissive.setRGB(0, 0, 0);
          mat.emissiveIntensity = 0;
        }
      }
    });
  }
  if (!pBike) return;
  (Object.keys(pBike.partMap) as BikePart[]).forEach(k => {
    for (const m of pBike!.partMap[k]) {
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat.emissiveIntensity !== 0) {
        mat.emissive.setRGB(0, 0, 0);
        mat.emissiveIntensity = 0;
      }
    }
  });
}

export function highlightPart(part: string | null): void {
  if (part !== 'tires' && part !== 'engine' && part !== 'gearbox' && part !== 'suspension') part = null;
  if (highlightedPart && highlightedPart !== part) clearEmissive();
  highlightedPart = part as BikePart | null;
  if (!highlightedPart) clearEmissive();
}

export function previewBikeColor(color: number[] | null): void {
  previewColor = color ? new THREE.Color(color[0] / 255, color[1] / 255, color[2] / 255) : null;
  if (pBike) {
    const c = previewColor ?? currentColor();
    pBike.bodyMats.forEach(m => m.color.copy(c));
    pGlb?.tintMats.forEach(m => m.color.copy(c));
  }
}

export function refreshPreviewBike(): void {
  previewColor = null;
  if (pBike) {
    const c = currentColor();
    pBike.bodyMats.forEach(m => m.color.copy(c));
    pGlb?.tintMats.forEach(m => m.color.copy(c));
  }
  applyTiers();
}
