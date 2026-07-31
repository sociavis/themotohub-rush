import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ═══════════════════════════════════════════════════════════════
//  Trackside prop library — "low poly Motocross Assets" by
//  e-restrepo1114 on Sketchfab (CC-BY-4.0). Paddock tents,
//  ambulance, porta-potties, grandstands, fences, billboards,
//  excavator, painted tires — cloned on demand per track build.
// ═══════════════════════════════════════════════════════════════

const norm = (n: string) => n.normalize('NFKD').replace(/[^a-zA-Z0-9 ]/g, '').trim().toLowerCase();

let props: Map<string, THREE.Object3D> | null = null;
let globalScale = 1;
let loading: Promise<void> | null = null;
const onReadyFns: (() => void)[] = [];

export function mxPropsReady(): boolean { return props !== null; }
export function onMxPropsLoaded(fn: () => void): void {
  if (props) fn();
  else onReadyFns.push(fn);
}

export function loadMxProps(): void {
  if (loading) return;
  loading = new Promise((resolve) => {
    new GLTFLoader().load('/models/mx-props.glb', (gltf) => {
      try {
        const scene = gltf.scene;
        scene.updateMatrixWorld(true);
        const map = new Map<string, THREE.Object3D>();
        // top-level prop groups live under the root chain; index anything
        // with a real name and mesh content
        scene.traverse(o => {
          if (!o.name || o.name.startsWith('Object_')) return;
          let hasMesh = false;
          o.traverse(c => { if ((c as THREE.Mesh).isMesh) hasMesh = true; });
          const key = norm(o.name);
          if (hasMesh && key && !map.has(key)) map.set(key, o);
        });
        // scale reference: the ambulance is ~2m tall in the real world
        const amb = map.get('ambulancia');
        if (amb) {
          const bb = new THREE.Box3().setFromObject(amb);
          const h = bb.max.y - bb.min.y || 1;
          globalScale = 2.0 / h;
        }
        props = map;
        onReadyFns.forEach(fn => fn());
        onReadyFns.length = 0;
      } catch (e) {
        console.warn('[props] index failed', e);
      }
      resolve();
    }, undefined, (err) => { console.warn('[props] load failed', err); resolve(); });
  });
}

// Clone a prop, normalized to world scale and grounded at y=0.
export function cloneMxProp(name: string, scaleMul = 1): THREE.Object3D | null {
  const src = props?.get(norm(name));
  if (!src) return null;
  const clone = src.clone(true);
  const g = new THREE.Group();
  g.add(clone);
  // neutralize the source's world transform, then apply library scale
  clone.matrixAutoUpdate = true;
  src.updateWorldMatrix(true, false);
  clone.position.set(0, 0, 0);
  clone.rotation.set(0, 0, 0);
  clone.scale.set(1, 1, 1);
  src.matrixWorld.decompose(clone.position, clone.quaternion, clone.scale);
  clone.position.set(0, 0, 0);
  g.scale.setScalar(globalScale * scaleMul);
  // ground it
  g.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(g);
  g.position.y = -bb.min.y;
  g.traverse(o => { if ((o as THREE.Mesh).isMesh) { (o as THREE.Mesh).castShadow = true; o.frustumCulled = true; } });
  return g;
}
