import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { TAU, lerp, rngFrom } from "./util.js";
import { scene, add } from "./core.js";
import { pbr } from "./textures.js";

// ---- ship dimensions (Gokstad: about 23.3 m long, 5.2 m wide, 16 strakes a side) ----
const SHIP = { Lh: 10.85, B: 5.2, D: 2.0, Y0: 0.45, strakes: 16 };
function makeHullFns(S) {
  const hb = (u) => (S.B / 2) * Math.pow(Math.max(0, 1 - u * u), 0.6);
  const rocker = S.rocker ?? 0.35, rise = S.rise ?? 1.15;
  const keelY = (u) => rocker * Math.pow(Math.abs(u), 4);
  const sheer = (u) => S.D + rise * Math.pow(Math.abs(u), 3.2);
  const xs = (s) => Math.pow(Math.sin((s * Math.PI) / 2), 0.75) * (1 + 0.05 * s);
  const ys = (s) => Math.pow(s, 1.25);
  const pt = (u, s, side = 1) => {
    const y = S.Y0 + keelY(u) + (sheer(u) - keelY(u)) * ys(s);
    const z = u * S.Lh + Math.sign(u) * Math.pow(Math.abs(u), 6) * 0.9 * ys(s) * (S.D / 2);
    return new THREE.Vector3(side * hb(u) * xs(s), y, z);
  };
  const normal = (u, s, side = 1) => {
    const a = pt(u, Math.max(0, s - 0.01), side), b = pt(u, Math.min(1, s + 0.01), side);
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
    return new THREE.Vector3(side * Math.abs(dy) / d, -Math.abs(dx) / d * 1, 0).normalize();
  };
  const deckS = 0.55;
  const deckY = (u) => pt(u, deckS).y;
  return { hb, keelY, sheer, xs, ys, pt, normal, deckY, deckS, S };
}
const H = makeHullFns(SHIP);

// ---- materials ----
const TEX_M = 1.4; // meters of oak covered by one texture tile
const std = (o) => new THREE.MeshStandardMaterial(o);
const hullMat = std({ ...pbr("hull"), color: 0xe0b083, vertexColors: true });
const woodMat = std({ ...pbr("hull", { repeat: [1, 3] }), color: 0xe0b083 }); // turned and sawn parts, grain along the length
const tubeWoodMat = std({ ...pbr("hull", { repeat: [6, 0.4], rotation: Math.PI / 2 }), color: 0xe0b083 }); // tubes run their length along u
const ironMat = std({ ...pbr("iron", { repeat: [0.2, 0.2] }), color: 0x8a8580 });
const deckMat = std({ ...pbr("deck", { repeat: [2.2, 8.5] }), color: 0xe0d2bd });
const chestMat = std({ ...pbr("hull", { repeat: [0.6, 0.6] }), color: 0xd6a979 });
const ropeMat = std({ color: 0x6b5a44, roughness: 0.95 });

// A grid surface from a point function, with winding chosen so normals face `outward`.
function grid(nu, nv, at, outward) {
  const pos = [], uv = [], col = [], idx = [];
  for (let a = 0; a <= nu; a++) for (let b = 0; b <= nv; b++) { const r = at(a / nu, b / nv); pos.push(r.p.x, r.p.y, r.p.z); uv.push(r.uv[0], r.uv[1]); col.push(r.c, r.c, r.c); }
  for (let a = 0; a < nu; a++) for (let b = 0; b < nv; b++) { const q = a * (nv + 1) + b, r = q + nv + 1; idx.push(q, r, q + 1, r, r + 1, q + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  g.computeVertexNormals();
  // flip if the middle normal points the wrong way
  const mid = Math.floor(nu / 2) * (nv + 1) + Math.floor(nv / 2), n = new THREE.Vector3().fromBufferAttribute(g.attributes.normal, mid);
  const want = outward(at(Math.floor(nu / 2) / nu, Math.floor(nv / 2) / nv));
  if (n.dot(want) < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); }
  return g;
}

// Clinker hull: every strake is a solid oak plank whose lower edge laps over the strake below.
function buildHull(S, Hf, opts = {}) {
  const group = new THREE.Group(), rivets = [];
  const nu = opts.nu || 90, lap = opts.lap || 0.038, thick = opts.thick || 0.025, R = rngFrom(opts.seed || 31);
  for (const side of [1, -1]) {
    const parts = [];
    for (let i = 0; i < S.strakes; i++) {
      const s0 = Math.max(0, i / S.strakes - 0.012), s1 = (i + 1) / S.strakes;
      const width = Hf.pt(0, s0).distanceTo(Hf.pt(0, s1));
      const tone = 0.88 + R() * 0.16, uOff = R() * 3, vOff = R();
      const tar = (s) => lerp(0.7, 1, THREE.MathUtils.smoothstep(s, 0.12, 0.42));
      const lapShade = (v) => lerp(1, 0.5, THREE.MathUtils.smoothstep(v, 0.7, 1)); // the strake above overhangs this one
      const surf = (u, v, inset) => {
        const s = lerp(s0, s1, v), n = Hf.normal(u, s, side);
        return Hf.pt(u, s, side).addScaledVector(n, lap * (1 - v) + 0.002 * i - inset);
      };
      const face = (inset) => (fu, fv) => {
        const u = -1 + 2 * fu, s = lerp(s0, s1, fv);
        return { p: surf(u, fv, inset), uv: [uOff + (fv * width) / TEX_M, vOff + (u * S.Lh) / TEX_M], c: tone * tar(s) * (inset ? 1 : lapShade(fv)), n: Hf.normal(u, s, side).multiplyScalar(inset ? -1 : 1) };
      };
      const edge = (v) => (fu, fb) => {
        const u = -1 + 2 * fu, s = lerp(s0, s1, v);
        return { p: surf(u, v, fb * thick), uv: [uOff + (fb * thick) / TEX_M, vOff + (u * S.Lh) / TEX_M], c: tone * tar(s), n: Hf.normal(u, s, side).cross(new THREE.Vector3(0, 0, 1)).multiplyScalar(side * (v ? -1 : 1)) };
      };
      parts.push(grid(nu, 3, face(0), (r) => r.n), grid(nu, 3, face(thick), (r) => r.n), grid(nu, 1, edge(0), (r) => r.n), grid(nu, 1, edge(1), (r) => r.n));
      // a row of clench rivets just above the lap
      if (i > 0) for (let z = -0.95; z <= 0.95; z += 0.17 / S.Lh) {
        const p = surf(z, 0.15, 0), n = Hf.normal(z, lerp(s0, s1, 0.15), side);
        if (Math.abs(z) < 0.97) rivets.push([p.addScaledVector(n, 0.002), n]);
      }
    }
    const m = new THREE.Mesh(mergeGeometries(parts), hullMat);
    add(m, { parent: group, solid: true });
  }
  if (opts.rivets !== false && rivets.length) {
    const rg = new THREE.SphereGeometry(opts.rivetR || 0.011, 6, 3, 0, TAU, 0, Math.PI / 2); rg.rotateX(Math.PI / 2);
    const im = new THREE.InstancedMesh(rg, ironMat, rivets.length), o = new THREE.Object3D();
    rivets.forEach(([p, n], k) => { o.position.copy(p); o.lookAt(p.clone().add(n)); o.updateMatrix(); im.setMatrixAt(k, o.matrix); });
    add(im, { parent: group, cast: false });
  }
  // keel and stems
  const keelR = opts.keelR || 0.11;
  const keelPts = []; for (let a = 0; a <= 20; a++) { const u = -0.95 + (1.9 * a) / 20; keelPts.push(new THREE.Vector3(0, S.Y0 + Hf.keelY(u) - 0.06, u * S.Lh)); }
  add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(keelPts), 40, keelR, 8), tubeWoodMat), { parent: group, solid: true });
  for (const sg of [1, -1]) {
    const L = S.Lh, Y = S.Y0;
    const k = (S.D + (S.rise ?? 1.15)) / 3.15; // stems scale with the hull's height (1 for the Gokstad ship)
    const pts = [[L - 1.0 * k, Y + 0.12 * k], [L - 0.2 * k, Y + 0.28 * k], [L + 0.15 * k, Y + 0.9 * k], [L + 0.45 * k, Y + 1.8 * k], [L + 0.8 * k, Y + 2.9 * k], [L + 1.0 * k, Y + 3.8 * k], [L + 0.95 * k, Y + 4.5 * k], [L + 0.7 * k, Y + 4.8 * k]];
    const curve = new THREE.CatmullRomCurve3(pts.map(([z, y]) => new THREE.Vector3(0, y, sg * z)));
    const stem = new THREE.TubeGeometry(curve, 60, keelR * 1.5, 12); stem.scale(0.55, 1, 1); // narrow athwartships, deep fore and aft
    add(new THREE.Mesh(stem, tubeWoodMat), { parent: group, solid: true });
  }
  return group;
}
const ship = buildHull(SHIP, H); scene.add(ship);

// frames
{
  const frames = [];
  for (let f = 0; f < 17; f++) {
    const u = -0.78 + (1.56 * f) / 16, pts = [];
    for (let a = 0; a <= 12; a++) { const s = H.deckS * (1 - a / 6); const sd = a <= 6 ? 1 : -1; const p = H.pt(u, Math.abs(s), sd); p.addScaledVector(H.normal(u, Math.abs(s), sd), -0.08); pts.push(p); }
    frames.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.06, 6));
  }
  add(new THREE.Mesh(mergeGeometries(frames), tubeWoodMat));
}
// deck
{
  const pos = [], uv = [], idx = [], n = 60;
  for (let a = 0; a <= n; a++) {
    const u = -0.8 + (1.6 * a) / n, y = H.deckY(u) + 0.02, w = H.hb(u) * H.xs(H.deckS) - 0.08;
    pos.push(-w, y, u * SHIP.Lh, w, y, u * SHIP.Lh); uv.push(0, a / n, 1, a / n);
  }
  for (let a = 0; a < n; a++) { const q = a * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  if (g.attributes.normal.getY(0) < 0) { g.index.array.reverse(); g.computeVertexNormals(); }
  add(new THREE.Mesh(g, deckMat), { solid: true, cast: false });
}
// gunwale rail
{
  const rails = [];
  for (const side of [1, -1]) { const pts = []; for (let a = 0; a <= 40; a++) { const u = -0.98 + (1.96 * a) / 40; const p = H.pt(u, 1, side); p.y += 0.04; pts.push(p); } rails.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 100, 0.07, 8)); }
  add(new THREE.Mesh(mergeGeometries(rails), tubeWoodMat));
}
// oar ports: 16 a side in the third strake from the top
{
  const portMat = std({ color: 0x120d0a, roughness: 1, side: THREE.DoubleSide }), rimMat = std({ color: 0x5a4030, roughness: 0.9 });
  const rims = [], holes = [], o = new THREE.Object3D();
  for (const side of [1, -1]) for (let j = 0; j < 16; j++) {
    const u = -0.62 + (1.24 * j) / 15, s = 13.5 / 16;
    const p = H.pt(u, s, side), n = H.normal(u, s, side); p.addScaledVector(n, 0.02);
    o.position.copy(p); o.lookAt(p.clone().add(n)); o.updateMatrix();
    rims.push(new THREE.RingGeometry(0.085, 0.1, 20).translate(0, 0, 0.004).applyMatrix4(o.matrix));
    holes.push(new THREE.CircleGeometry(0.085, 20).translate(0, 0, 0.002).applyMatrix4(o.matrix));
  }
  add(new THREE.Mesh(mergeGeometries(rims), rimMat), { cast: false });
  add(new THREE.Mesh(mergeGeometries(holes), portMat), { cast: false });
}
// shields: 32 a side, alternately yellow and black, overlapping along the rail (hung on the aft half only)
const shieldGroup = [];
{
  const paint = (color) => std({ color, roughness: 0.78, normalMap: pbr("hull", { repeat: [0.5, 0.5] }).normalMap, normalScale: new THREE.Vector2(0.3, 0.3) });
  const mats = [paint(0xd7a531), paint(0x1e1b19)];
  const disc = new THREE.CylinderGeometry(0.47, 0.47, 0.018, 40); disc.rotateX(Math.PI / 2);
  const boss = new THREE.SphereGeometry(0.075, 16, 8, 0, TAU, 0, Math.PI / 2); boss.scale(1, 0.55, 1); boss.rotateX(Math.PI / 2); boss.translate(0, 0, 0.009);
  const bossMat = std({ ...pbr("iron", { repeat: [0.2, 0.2] }), color: 0x6a6460 });
  for (const side of [1, -1]) for (let j = 0; j < 32; j++) {
    const u = -0.68 + (1.36 * j) / 31, s = 0.93;
    if (u < (side === 1 ? 0.02 : -0.08)) continue;
    const p = H.pt(u, s, side), n = H.normal(u, s, side); n.y = 0; n.normalize();
    p.x = side * (Math.abs(H.pt(u, 1, side).x) + 0.09 + (j % 2) * 0.024); // outside the rail, overlapping
    const g = new THREE.Group(); g.add(new THREE.Mesh(disc, mats[j % 2]), new THREE.Mesh(boss, bossMat));
    g.position.copy(p); g.lookAt(p.clone().add(n)); g.rotateZ((j * 1.7) % 1); add(g); shieldGroup.push(g);
  }
}
// side rudder on the starboard quarter
const rudderPivot = H.pt(0.8, 0.95, 1).add(new THREE.Vector3(0.3, 0, 0));
const rudder = new THREE.Group(); rudder.position.copy(rudderPivot);
{
  // the steering board: a narrow neck at the top, a broad blade below
  const prof = new THREE.Shape();
  prof.moveTo(-0.11, 1.65); prof.lineTo(0.11, 1.65); prof.lineTo(0.13, 0.4); prof.quadraticCurveTo(0.34, 0.1, 0.36, -0.9); prof.quadraticCurveTo(0.34, -1.55, 0.05, -1.65); prof.lineTo(-0.18, -1.6); prof.quadraticCurveTo(-0.24, -0.6, -0.12, 0.4); prof.closePath();
  const bg = new THREE.ExtrudeGeometry(prof, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 10 });
  bg.translate(0, 0, -0.035); bg.rotateY(Math.PI / 2);
  const blade = new THREE.Mesh(bg, woodMat); blade.position.set(0, -0.9, 0.9); blade.rotation.x = -0.5; rudder.add(blade);
  const boss = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.4, 0.5), woodMat); boss.position.set(-0.2, -1.4, 0); rudder.add(boss);
  const tiller = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.4, 8), woodMat); tiller.rotation.z = Math.PI / 2; tiller.position.set(-0.6, 0.15, 0); rudder.add(tiller);
}
add(rudder);
// mast, mast fish, crutches, yard and sail
const midU = -0.03, mastZ = midU * SHIP.Lh, deck0 = H.deckY(midU);
add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 4.6), woodMat).translateY(deck0 + 0.18).translateZ(mastZ + 0.6), { solid: true });
const MAST_H = 11;
add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, MAST_H, 16), woodMat).translateY(deck0 + MAST_H / 2).translateZ(mastZ), { solid: true });
for (const u of [-0.42, 0.22, 0.55]) {
  const y0 = H.deckY(u);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.1, 0.14), woodMat).translateY(y0 + 1.05).translateZ(u * SHIP.Lh));
  add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 0.14), woodMat).translateY(y0 + 2.1).translateZ(u * SHIP.Lh));
}
// stowed oars resting on the crutches
for (let j = 0; j < 6; j++) { const o = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 5.6, 8), woodMat); o.rotation.x = Math.PI / 2 + 0.03; o.position.set(-0.32 + j * 0.12, H.deckY(0.2) + 2.22, 0.2 * SHIP.Lh - 0.6); add(o); }
const yardRig = new THREE.Group(); scene.add(yardRig);
add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 11, 10), woodMat).rotateZ(Math.PI / 2), { parent: yardRig });
// wool sail with sewn red stripes (the size and pattern are a reconstruction)
const stripes = (mat, n, axis = "x") => {
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
      float st = step(0.5, fract(vMapUv.${axis} * ${n.toFixed(1)} / ${mat.map.repeat[axis].toFixed(2)}));
      diffuseColor.rgb *= mix(vec3(1.0, 0.97, 0.9), vec3(0.62, 0.13, 0.09), st);`);
  };
  return mat;
};
const sailMat = stripes(std({ ...pbr("cloth", { repeat: [4, 3.4] }), color: 0xf2ece0, side: THREE.DoubleSide }), 8);
const sailGeo = new THREE.PlaneGeometry(10.4, 8.6, 24, 18); sailGeo.translate(0, -4.3, 0);
{ const p = sailGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, -0.9 * Math.sin(((x + 5.2) / 10.4) * Math.PI) * Math.sin((-y / 8.6) * Math.PI * 0.9)); } sailGeo.computeVertexNormals(); }
const sail = new THREE.Mesh(sailGeo, sailMat); sail.position.set(0, -0.1, -0.15); add(sail, { parent: yardRig });
const furl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 10, 16), stripes(std({ ...pbr("cloth", { repeat: [1, 8] }), color: 0xf2ece0 }), 8, "y")); furl.rotation.z = Math.PI / 2; furl.position.set(0, -0.24, 0); add(furl, { parent: yardRig });
// rigging: forestay, backstay and two shrouds as rope
for (const [x, z] of [[0, -SHIP.Lh - 0.9], [0, SHIP.Lh + 0.9], [2.4, mastZ + 1.2], [-2.4, mastZ + 1.2]]) {
  const a = new THREE.Vector3(0, deck0 + MAST_H - 0.3, mastZ), b = new THREE.Vector3(x, x ? H.pt(midU + 0.1, 1).y : SHIP.Y0 + 4.2, z);
  add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(a, b), 1, 0.014, 5), ropeMat), { receive: false });
}
const sail$ = { amt: 0, target: 0 };
function placeSail(a) {
  const yTop = lerp(H.deckY(0.22) + 2.3, deck0 + MAST_H - 0.6, a);
  yardRig.position.set(0, yTop, lerp(0.22 * SHIP.Lh - 1.2, mastZ - 0.3, a));
  yardRig.rotation.y = (1 - Math.min(1, a * 1.6)) * Math.PI / 2;
  sail.scale.set(1, Math.max(0.01, a), 1); sail.visible = a > 0.02;
  furl.visible = a < 0.6; furl.scale.set(1 - a * 0.6, 1, 1 - a * 0.6);
}
placeSail(0);
// sea chests along both sides of the deck (rowers' seats)
{
  const chests = [];
  for (const side of [1, -1]) for (let j = 0; j < 8; j++) {
    const u = -0.62 + (1.24 * j) / 7; if (side === 1 && j === 6) continue;
    const w = H.hb(u) * H.xs(H.deckS) - 0.45;
    chests.push(new THREE.BoxGeometry(0.42, 0.42, 0.8).translate(side * w, H.deckY(u) + 0.23, u * SHIP.Lh));
  }
  add(new THREE.Mesh(mergeGeometries(chests), chestMat));
}

// ---- small boat (one of three found in the mound) ----
const BOAT = { Lh: 3.0, B: 1.35, D: 0.55, Y0: 0.04, strakes: 5, rise: 0.38, rocker: 0.08 };
const HB = makeHullFns(BOAT);
const boat = buildHull(BOAT, HB, { nu: 40, lap: 0.018, thick: 0.018, keelR: 0.05, rivetR: 0.008, seed: 77 });
{
  // two thwarts and light frames inside the boat
  const parts = [];
  for (const u of [-0.25, 0.3]) { const y = HB.pt(u, 0.82).y, w = HB.hb(u) * HB.xs(0.82); parts.push(new THREE.BoxGeometry(w * 2, 0.04, 0.22).translate(0, y, u * BOAT.Lh)); }
  for (let f = 0; f < 7; f++) {
    const u = -0.7 + (1.4 * f) / 6, pts = [];
    for (let a = 0; a <= 10; a++) { const s = 0.75 * (1 - a / 5), sd = a <= 5 ? 1 : -1; const p = HB.pt(u, Math.abs(s), sd); p.addScaledVector(HB.normal(u, Math.abs(s), sd), -0.03); pts.push(p); }
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.025, 5));
  }
  add(new THREE.Mesh(mergeGeometries(parts.map((g) => g.index ? g.toNonIndexed() : g)), woodMat), { parent: boat });
}
boat.position.set(8.5, -0.02, -12.5); boat.rotation.y = 0.5; boat.rotation.z = 0.08; scene.add(boat);

export { SHIP, makeHullFns, H, hullMat, buildHull, woodMat, tubeWoodMat, ironMat, chestMat, rudderPivot, rudder, midU, mastZ, deck0, MAST_H, sail$, placeSail, shieldGroup, std };
