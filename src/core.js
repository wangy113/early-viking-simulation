import * as THREE from "three";

// ---------------- renderer and world ----------------
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xe9e2cf, 60, 420);
scene.background = new THREE.Color(0xdfe6e0);
const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 2000);
scene.add(new THREE.HemisphereLight(0xfff6e2, 0x8a7a5a, 2.1));
const sun = new THREE.DirectionalLight(0xfff0d0, 1.6); sun.position.set(-30, 40, 20); scene.add(sun);
const lam = (map, o = {}) => new THREE.MeshLambertMaterial({ map, ...o });
const basic = (map, o = {}) => new THREE.MeshBasicMaterial({ map, toneMapped: false, ...o });
const solids = []; // meshes that block hotspot markers and catch walk clicks

export { canvas, renderer, scene, camera, sun, lam, basic, solids };
