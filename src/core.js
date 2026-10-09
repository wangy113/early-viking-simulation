import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { QUALITY, TIER } from "./quality.js";

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, TIER.dpr));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 6000);

// The sun. Its direction and the sky light are set from the HDR sky in world.js.
const sun = new THREE.DirectionalLight(0xfff3e0, 3.2);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(TIER.shadow);
Object.assign(sun.shadow.camera, { left: -TIER.shadowArea, right: TIER.shadowArea, top: TIER.shadowArea, bottom: -TIER.shadowArea, near: 1, far: 140 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

const solids = []; // meshes that block hotspot markers and catch walk clicks

// Every mesh casts and receives shadows unless told otherwise.
function add(obj, { cast = true, receive = true, solid = false, parent = scene } = {}) {
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; } });
  parent.add(obj);
  if (solid) obj.traverse((o) => { if (o.isMesh) solids.push(o); });
  return obj;
}

// Merge every plain mesh inside a group into one mesh per material, keeping their placement.
// Many small parts become a few draw calls. Skinned and instanced meshes are left alone.
function bakeStatic(group) {
  group.updateMatrixWorld(true);
  const inv = group.matrixWorld.clone().invert(), buckets = new Map(), m4 = new THREE.Matrix4(), dead = [];
  group.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || Array.isArray(o.material)) return;
    const src = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    src.applyMatrix4(m4.multiplyMatrices(inv, o.matrixWorld));
    const g = new THREE.BufferGeometry(), n = src.attributes.position.count;
    g.setAttribute("position", src.attributes.position);
    g.setAttribute("uv", src.attributes.uv || new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    if (src.attributes.normal) g.setAttribute("normal", src.attributes.normal); else g.computeVertexNormals();
    if (!buckets.has(o.material)) buckets.set(o.material, { list: [], cast: false });
    const b = buckets.get(o.material); b.list.push(g); b.cast ||= o.castShadow; dead.push(o);
  });
  for (const o of dead) o.removeFromParent();
  for (const [material, { list, cast }] of buckets) { const m = new THREE.Mesh(mergeGeometries(list), material); m.castShadow = cast; m.receiveShadow = true; group.add(m); }
  return group;
}

export { QUALITY, TIER, bakeStatic, canvas, renderer, scene, camera, sun, solids, add };
