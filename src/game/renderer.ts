import * as THREE from 'three';
import { makeGroundTexture, makeGlowSprite, makeCloudSprite } from './textures';

// ── Renderer ──
const canvas = document.getElementById('c3d') as HTMLCanvasElement;
export const R = new THREE.WebGLRenderer({ canvas, antialias: true });
// Cap pixel ratio harder on touch devices (WebView perf headroom)
const isCoarse = matchMedia('(pointer:coarse)').matches;
R.setPixelRatio(Math.min(devicePixelRatio, isCoarse ? 1.5 : 2));
R.setSize(innerWidth, innerHeight);
R.setClearColor(0x9db8d8);
R.toneMapping = THREE.ACESFilmicToneMapping;
R.toneMappingExposure = 1.05;
R.shadowMap.enabled = true;
R.shadowMap.type = THREE.PCFSoftShadowMap;

// ── Scene ──
export const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xd8c9ae, 0.0035);

// ── Camera ──
export const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1400);
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
export const hemiL = new THREE.HemisphereLight(0xbcd7f0, 0xb08a5e, 0.85);
scene.add(hemiL);

// Kept for API compatibility with older modules (subtle fill)
export const ambL = new THREE.AmbientLight(0xffffff, 0.12);
scene.add(ambL);

// Sun
export const dirL = new THREE.DirectionalLight(0xfff1dc, 2.2);
dirL.position.set(60, 90, 30);
dirL.castShadow = true;
dirL.shadow.mapSize.set(isCoarse ? 1024 : 2048, isCoarse ? 1024 : 2048);
dirL.shadow.camera.left = -75;
dirL.shadow.camera.right = 75;
dirL.shadow.camera.top = 75;
dirL.shadow.camera.bottom = -75;
dirL.shadow.camera.near = 10;
dirL.shadow.camera.far = 300;
dirL.shadow.bias = -0.0006;
scene.add(dirL);
scene.add(dirL.target);

// ── Sky dome (gradient shader) ──
const skyUniforms = {
  topColor: { value: new THREE.Color(0x4a90d9) },
  bottomColor: { value: new THREE.Color(0xf5d9a8) },
  offset: { value: 20 },
  exponent: { value: 0.55 },
};
const skyMat = new THREE.ShaderMaterial({
  uniforms: skyUniforms,
  vertexShader: `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    uniform float offset;
    uniform float exponent;
    varying vec3 vWorldPosition;
    void main() {
      float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
      gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
    }`,
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
});
export const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 12), skyMat);
sky.renderOrder = -10;
scene.add(sky);

// ── Sun disc ──
const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: makeGlowSprite('rgba(255,250,235,1)', 'rgba(255,230,180,0)'),
  transparent: true,
  depthWrite: false,
  fog: false,
}));
sunSprite.scale.setScalar(120);
scene.add(sunSprite);

// ── Clouds ──
export const cloudsGroup = new THREE.Group();
const cloudTex = makeCloudSprite();
for (let i = 0; i < 8; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: cloudTex, transparent: true, opacity: 0.55 + Math.random() * 0.3, depthWrite: false, fog: false,
  }));
  const ang = (i / 8) * Math.PI * 2 + Math.random();
  const dist = 260 + Math.random() * 300;
  s.position.set(Math.cos(ang) * dist, 90 + Math.random() * 90, Math.sin(ang) * dist);
  const w = 90 + Math.random() * 130;
  s.scale.set(w, w * 0.42, 1);
  cloudsGroup.add(s);
}
scene.add(cloudsGroup);

// ── Ground ──
const groundGeo = new THREE.CircleGeometry(600, 48);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  map: makeGroundTexture('#c9a06a', '#a8814e'),
  roughness: 1,
  metalness: 0,
});
groundMat.map!.repeat.set(70, 70);
export const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.03;
ground.receiveShadow = true;
scene.add(ground);

const groundTexCache: Record<string, THREE.CanvasTexture> = {};

// ── Atmosphere API (used by track-builder per environment) ──
export interface AtmosphereOpts {
  skyTop: number;
  skyHorizon: number;
  fogColor: number;
  fogDensity: number;
  sunColor: number;
  sunIntensity: number;
  sunPos: [number, number, number];
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  groundKey: string;
  groundBase: string;
  groundDark: string;
  clouds: boolean;
  sunDisc: boolean;
  exposure?: number;
}

export function applyAtmosphere(o: AtmosphereOpts): void {
  skyUniforms.topColor.value.set(o.skyTop);
  skyUniforms.bottomColor.value.set(o.skyHorizon);
  R.setClearColor(new THREE.Color(o.fogColor));
  (scene.fog as THREE.FogExp2).color.set(o.fogColor);
  (scene.fog as THREE.FogExp2).density = o.fogDensity;
  dirL.color.set(o.sunColor);
  dirL.intensity = o.sunIntensity;
  dirL.position.set(...o.sunPos);
  hemiL.color.set(o.hemiSky);
  hemiL.groundColor.set(o.hemiGround);
  hemiL.intensity = o.hemiIntensity;
  R.toneMappingExposure = o.exposure ?? 1.05;
  cloudsGroup.visible = o.clouds;
  sunSprite.visible = o.sunDisc;
  const sunDir = new THREE.Vector3(...o.sunPos).normalize();
  sunSprite.position.copy(sunDir.multiplyScalar(850));
  if (!groundTexCache[o.groundKey]) {
    const t = makeGroundTexture(o.groundBase, o.groundDark);
    t.repeat.set(70, 70);
    groundTexCache[o.groundKey] = t;
  }
  groundMat.map = groundTexCache[o.groundKey];
  groundMat.needsUpdate = true;
}
