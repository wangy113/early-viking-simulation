import * as THREE from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import manifest from "./assets-manifest.json";
import trees from "./trees-manifest.json";
import { TIER } from "./quality.js";
import { preloadPeople } from "./humans.js";

// Loads every texture once before the scene is built. Scene code then asks for
// clones with its own repeat and rotation, which share the uploaded image.
const base = import.meta.env.BASE_URL + "assets/";
const loaded = new Map();
let hdr = null;
const SIZE = TIER.tex; // texture size for this quality level
const treeFile = trees.atlas[SIZE >= 2048 ? "2k" : "1k"];

function preloadAssets(onProgress = () => {}) {
  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, done, total) => onProgress(done / total);
  const tl = new THREE.TextureLoader(manager);
  const files = new Set([manifest.sky.backdrop, "tex/waternormals.jpg", treeFile]);
  for (const set of Object.values(manifest.textures)) for (const bySize of Object.values(set)) files.add(bySize[SIZE]);
  return new Promise((resolve, reject) => {
    manager.onLoad = () => resolve();
    manager.onError = (url) => reject(new Error(`Could not load ${url}`));
    for (const f of files) loaded.set(f, tl.load(base + f));
    new HDRLoader(manager).setDataType(THREE.HalfFloatType).load(base + manifest.sky.light, (t) => { hdr = t; });
    preloadPeople(manager);
  });
}

function file(f, { repeat = [1, 1], rotation = 0, srgb = false, wrap = true } = {}) {
  const src = loaded.get(f);
  if (!src) throw new Error(`Texture ${f} was not preloaded`);
  const t = src.clone();
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.rotation = rotation; t.center.set(0.5, 0.5);
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

// Material maps for one PBR set: albedo, OpenGL normal, and AO/roughness/metal packed in one image.
function pbr(role, { size = SIZE, ...opts } = {}) {
  const set = manifest.textures[role];
  if (!set) throw new Error(`Unknown texture set ${role}`);
  const arm = file(set.arm[size], opts);
  return { map: file(set.diff[size], { ...opts, srgb: true }), normalMap: file(set.nor[size], opts), aoMap: arm, roughnessMap: arm, metalnessMap: arm };
}

// the woods: renders of real trees from 8 directions (see scripts/build-trees.mjs)
const treeAtlas = () => { const t = file(treeFile, { srgb: true, wrap: false }); t.anisotropy = 4; return t; };
const skyBackdrop = () => file(manifest.sky.backdrop, { srgb: true, wrap: false });
const skyLight = () => hdr;

// Direction of the brightest pixel in the HDR sky, in three.js equirectangular convention.
function sunDirection() {
  const { width: W, height: Hh, data } = hdr.image;
  const f = (h) => (hdr.type === THREE.HalfFloatType ? THREE.DataUtils.fromHalfFloat(h) : h);
  let best = -1, bi = 0;
  for (let i = 0; i < W * Hh; i++) { const L = 0.2126 * f(data[i * 4]) + 0.7152 * f(data[i * 4 + 1]) + 0.0722 * f(data[i * 4 + 2]); if (L > best) { best = L; bi = i; } }
  const u = ((bi % W) + 0.5) / W, v = 1 - (Math.floor(bi / W) + 0.5) / Hh;
  const lon = (u - 0.5) * Math.PI * 2, lat = (v - 0.5) * Math.PI;
  return new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
}

export { preloadAssets, file, pbr, skyBackdrop, skyLight, sunDirection, treeAtlas, trees as treeInfo };
