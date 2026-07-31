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
        // flattened GLB: parts are sibling meshes named "<prop>_N" — group
        // them per prop into detached templates with world transforms baked
        const parts = new Map<string, THREE.Mesh[]>();
        scene.traverse(o => {
          const m = o as THREE.Mesh;
          if (!m.isMesh || !m.name || m.name.startsWith('Object_')) return;
          const key = norm(m.name.replace(/_\d+$/, ''));
          if (!key) return;
          if (!parts.has(key)) parts.set(key, []);
          parts.get(key)!.push(m);
        });
        for (const [key, list] of parts) {
          const g = new THREE.Group();
          for (const part of list) {
            const pc = part.clone(true);
            part.updateWorldMatrix(true, false);
            part.matrixWorld.decompose(pc.position, pc.quaternion, pc.scale);
            g.add(pc);
          }
          // recentre the group's parts on their shared centroid (XZ)
          const bb = new THREE.Box3().setFromObject(g);
          const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
          for (const c of g.children) { c.position.x -= cx; c.position.z -= cz; }
          map.set(key, g);
        }
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
  g.scale.setScalar(globalScale * scaleMul);
  // ground it
  g.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(g);
  g.position.y = -bb.min.y;
  g.traverse(o => { if ((o as THREE.Mesh).isMesh) { (o as THREE.Mesh).castShadow = true; o.frustumCulled = true; } });
  return g;
}
