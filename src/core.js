import * as THREE from "three";

// Quality tier. Automatic selection and a visible Quality button come in the performance milestone.
const QUALITY = ["low", "medium", "high"].includes(new URLSearchParams(location.search).get("quality")) ? new URLSearchParams(location.search).get("quality") : "high";

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, QUALITY === "low" ? 1 : 1.5));
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
sun.shadow.mapSize.setScalar(QUALITY === "low" ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 140 });
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

export { QUALITY, canvas, renderer, scene, camera, sun, solids, add };
