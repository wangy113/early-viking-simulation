import * as THREE from "three";
import { TAU, lerp } from "./util.js";
import { ell, paintTex, C } from "./painter.js";
import { scene, lam, basic, solids } from "./core.js";

// ---- ship dimensions (Gokstad: about 23.3 m long, 5.2 m wide, 16 strakes a side) ----
const SHIP = { Lh: 10.85, B: 5.2, D: 2.0, Y0: 0.45, strakes: 16 };
function makeHullFns(S) {
  const hb = (u) => (S.B / 2) * Math.pow(Math.max(0, 1 - u * u), 0.6);
  const keelY = (u) => 0.35 * Math.pow(Math.abs(u), 4);
  const sheer = (u) => S.D + 1.15 * Math.pow(Math.abs(u), 3.2);
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

const plankTex = paintTex(1024, 128, 501, (P, c, w, h) => {
  P.wash([[0, 0], [w, 0], [w, h], [0, h]], C.oak, { alpha: 0.75, jit: 1.5, edge: 0 });
  for (let i = 0; i < 14; i++) { const y = P.rr(10, h - 10); P.pencil([[0, y], [w * 0.3, y + P.rr(-4, 4)], [w * 0.7, y + P.rr(-4, 4)], [w, y]], { w: 0.8, alpha: 0.35, color: C.oakD, passes: 1 }); }
  P.wash([[0, 0], [w, 0], [w, 14], [0, 18]], "#4a3020", { alpha: 0.45, grain: false, edge: 0 });
  for (let x = 12; x < w; x += 34) { P.dot(x, h - 14, 4.2, C.iron, 0.85); P.dot(x - 1, h - 15, 1.6, "#a8a4a0", 0.8); }
  P.pencil([[0, h - 3], [w, h - 3]], { w: 1.4, alpha: 0.7 });
}, [6, 1]);
const hullMat = lam(plankTex, { side: THREE.DoubleSide });

function buildHull(S, Hf, mat, opts = {}) {
  const group = new THREE.Group();
  const nu = opts.nu || 90, t = opts.t || 0.03;
  for (const side of [1, -1]) {
    for (let i = 0; i < S.strakes; i++) {
      const s0 = Math.max(0, i / S.strakes - 0.012), s1 = (i + 1) / S.strakes;
      const pos = [], uv = [], idx = [], nv = 3;
      for (let a = 0; a <= nu; a++) {
        const u = -1 + (2 * a) / nu;
        for (let b = 0; b <= nv; b++) {
          const v = b / nv, s = lerp(s0, s1, v);
          const p = Hf.pt(u, s, side), n = Hf.normal(u, s, side);
          p.addScaledVector(n, t * (1 - v) + 0.002 * i);
          pos.push(p.x, p.y, p.z); uv.push(((u + 1) / 2), v);
        }
      }
      for (let a = 0; a < nu; a++) for (let b = 0; b < nv; b++) { const q = a * (nv + 1) + b, r = q + nv + 1; idx.push(q, r, q + 1, r, r + 1, q + 1); }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); group.add(m); solids.push(m);
    }
  }
  // keel and stems
  const keelPts = []; for (let a = 0; a <= 20; a++) { const u = -0.95 + (1.9 * a) / 20; keelPts.push(new THREE.Vector3(0, S.Y0 + Hf.keelY(u) - 0.06, u * S.Lh)); }
  const keel = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(keelPts), 40, opts.keelR || 0.11, 6), lam(plankTex)); group.add(keel); solids.push(keel);
  const sc = S.D / 2;
  for (const sg of [1, -1]) {
    const L = S.Lh, Y = S.Y0;
    const pts = [[L - 1.0, Y + 0.12], [L - 0.2, Y + 0.28], [L + 0.15 * sc, Y + 0.9 * sc], [L + 0.45 * sc, Y + 1.8 * sc], [L + 0.8 * sc, Y + 2.9 * sc], [L + 1.0 * sc, Y + 3.8 * sc], [L + 0.95 * sc, Y + 4.5 * sc], [L + 0.7 * sc, Y + 4.8 * sc]];
    const curve = new THREE.CatmullRomCurve3(pts.map(([z, y]) => new THREE.Vector3(0, y, sg * z)));
    const stem = new THREE.Mesh(new THREE.TubeGeometry(curve, 50, (opts.keelR || 0.11) * 1.15, 8), lam(plankTex)); group.add(stem); solids.push(stem);
  }
  return group;
}
const ship = buildHull(SHIP, H, hullMat); scene.add(ship);

// frames, crossbeams and deck
const woodMat = lam(paintTex(256, 256, 502, (P, c, w, h) => { P.wash([[0, 0], [w, 0], [w, h], [0, h]], C.oakL, { alpha: 0.8, edge: 0 }); for (let i = 0; i < 8; i++) { const y = P.rr(0, h); P.pencil([[0, y], [w, y + P.rr(-6, 6)]], { w: 0.8, alpha: 0.3, color: C.oakD, passes: 1 }); } }));
for (let f = 0; f < 17; f++) {
  const u = -0.78 + (1.56 * f) / 16, pts = [];
  for (let a = 0; a <= 12; a++) { const s = H.deckS * (1 - a / 6); const sd = s >= 0 ? 1 : -1; const p = H.pt(u, Math.abs(s), a <= 6 ? 1 : -1); p.addScaledVector(H.normal(u, Math.abs(s), a <= 6 ? 1 : -1), -0.06); pts.push(p); }
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.06, 5), woodMat));
}
const deckTex = paintTex(512, 512, 503, (P, c, w, h) => {
  P.wash([[0, 0], [w, 0], [w, h], [0, h]], "#c7a274", { alpha: 0.85, edge: 0 });
  for (let x = 0; x < w; x += 42) { P.pencil([[x, 0], [x + P.rr(-2, 2), h]], { w: 1.2, alpha: 0.55 }); for (let i = 0; i < 3; i++) { const xx = x + P.rr(6, 36); P.pencil([[xx, 0], [xx, h]], { w: 0.7, alpha: 0.22, color: C.oakD, passes: 1 }); } }
}, [3, 8]);
{
  const pos = [], uv = [], idx = [], n = 60;
  for (let a = 0; a <= n; a++) {
    const u = -0.8 + (1.6 * a) / n, y = H.deckY(u) + 0.02, w = H.hb(u) * H.xs(H.deckS) - 0.08;
    pos.push(-w, y, u * SHIP.Lh, w, y, u * SHIP.Lh); uv.push(0, a / n, 1, a / n);
  }
  for (let a = 0; a < n; a++) { const q = a * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const deck = new THREE.Mesh(g, lam(deckTex, { side: THREE.DoubleSide })); scene.add(deck); solids.push(deck);
}
// gunwale rail
for (const side of [1, -1]) {
  const pts = []; for (let a = 0; a <= 40; a++) { const u = -0.98 + (1.96 * a) / 40; const p = H.pt(u, 1, side); p.y += 0.04; pts.push(p); }
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.07, 6), lam(plankTex)));
}
// oar ports: 16 a side in the third strake from the top
const portMat = basic(null, { color: 0x2a201a }), rimMat = basic(null, { color: 0xb08a5a });
for (const side of [1, -1]) for (let j = 0; j < 16; j++) {
  const u = -0.62 + (1.24 * j) / 15, s = 13.5 / 16;
  const p = H.pt(u, s, side), n = H.normal(u, s, side); p.addScaledVector(n, 0.035);
  const rim = new THREE.Mesh(new THREE.CircleGeometry(0.11, 14), rimMat), hole = new THREE.Mesh(new THREE.CircleGeometry(0.075, 14), portMat);
  for (const m of [rim, hole]) { m.position.copy(p); m.lookAt(p.clone().add(n)); scene.add(m); }
  hole.position.addScaledVector(n, 0.005);
}
// shields: 32 a side, alternately yellow and black, overlapping along the rail
function shieldTex(col, seed) { return paintTex(256, 256, seed, (P, c, w) => { P.shape(ell(w / 2, w / 2, w * 0.47, w * 0.47, 36), col, { alpha: 0.8 }); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; P.pencil([[w / 2, w / 2], [w / 2 + Math.cos(a) * w * 0.46, w / 2 + Math.sin(a) * w * 0.46]], { w: 0.9, alpha: 0.25, passes: 1 }); } P.shape(ell(w / 2, w / 2, w * 0.11, w * 0.11, 18), "#9a9893", { alpha: 0.85 }); }); }
const shieldMats = [shieldTex(C.shieldY, 511), shieldTex(C.shieldK, 512)].map((t) => lam(t, { transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }));
const shieldGroup = [];
for (const side of [1, -1]) for (let j = 0; j < 32; j++) {
  const u = -0.68 + (1.36 * j) / 31, s = 0.93;
  if (u < (side === 1 ? 0.02 : -0.08)) continue;
  const p = H.pt(u, s, side), n = H.normal(u, s, side); n.y = 0; n.normalize(); p.addScaledVector(n, 0.06 + (j % 2) * 0.012);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.94), shieldMats[j % 2]);
  m.position.copy(p); m.lookAt(p.clone().add(n)); scene.add(m); shieldGroup.push(m);
}
// side rudder on the starboard quarter
const rudderPivot = H.pt(0.8, 0.95, 1).add(new THREE.Vector3(0.3, 0, 0));
const rudder = new THREE.Group(); rudder.position.copy(rudderPivot);
{
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.3, 0.5), lam(plankTex)); blade.position.set(0, -0.9, 0.9); blade.rotation.x = -0.5; rudder.add(blade);
  const boss = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.4, 0.5), lam(plankTex)); boss.position.set(-0.2, -1.4, 0); rudder.add(boss);
  const tiller = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.4, 6), woodMat); tiller.rotation.z = Math.PI / 2; tiller.position.set(-0.6, 0.15, 0); rudder.add(tiller);
}
scene.add(rudder);
// mast, mast fish, crutches, yard and sail
const midU = -0.03, mastZ = midU * SHIP.Lh, deck0 = H.deckY(midU);
const fish = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 4.6), lam(paintTex(256, 256, 521, (P, c, w, h) => P.shape([[4, 4], [w - 4, 4], [w - 4, h - 4], [4, h - 4]], "#9a6e42", { alpha: 0.8 })))); fish.position.set(0, deck0 + 0.18, mastZ + 0.6); scene.add(fish); solids.push(fish);
const MAST_H = 11;
const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, MAST_H, 10), woodMat); mast.position.set(0, deck0 + MAST_H / 2, mastZ); scene.add(mast); solids.push(mast);
for (const u of [-0.42, 0.22, 0.55]) {
  const y0 = H.deckY(u), post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.1, 0.14), woodMat); post.position.set(0, y0 + 1.05, u * SHIP.Lh); scene.add(post);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 0.14), woodMat); bar.position.set(0, y0 + 2.1, u * SHIP.Lh); scene.add(bar);
}
// stowed oars resting on the crutches
for (let j = 0; j < 6; j++) { const o = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 5.6, 5), woodMat); o.rotation.x = Math.PI / 2 + 0.03; o.position.set(-0.32 + j * 0.12, H.deckY(0.2) + 2.22, 0.2 * SHIP.Lh - 0.6); scene.add(o); }
const yardRig = new THREE.Group(); scene.add(yardRig);
const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 11, 8), woodMat); yard.rotation.z = Math.PI / 2; yardRig.add(yard);
const sailTex = paintTex(1024, 900, 531, (P, c, w, h) => {
  P.wash([[0, 0], [w, 0], [w, h], [0, h]], C.sailW, { alpha: 0.85, edge: 0, jit: 1 });
  for (let x = 0; x < w; x += 128) P.wash([[x + 64, 0], [x + 128, 0], [x + 128, h], [x + 64, h]], C.sailR, { alpha: 0.6, jit: 2, edge: 0.3 });
  for (let y = 60; y < h; y += 110) P.pencil([[0, y], [w, y + P.rr(-4, 4)]], { w: 0.8, alpha: 0.25, passes: 1 });
  P.pencil([[2, 2], [w - 2, 2], [w - 2, h - 2], [2, h - 2], [2, 2]], { w: 2, alpha: 0.6 });
});
const sailGeo = new THREE.PlaneGeometry(10.4, 8.6, 20, 16); sailGeo.translate(0, -4.3, 0);
{ const p = sailGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, -0.9 * Math.sin(((x + 5.2) / 10.4) * Math.PI) * Math.sin((-y / 8.6) * Math.PI * 0.9)); } sailGeo.computeVertexNormals(); }
const sail = new THREE.Mesh(sailGeo, lam(sailTex, { side: THREE.DoubleSide })); sail.position.set(0, -0.1, -0.15); yardRig.add(sail);
const furl = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 10, 10), lam(paintTex(256, 128, 532, (P, c, w, h) => { P.wash([[0, 0], [w, 0], [w, h], [0, h]], C.sailW, { alpha: 0.8 }); for (let x = 0; x < w; x += 32) P.wash([[x, 0], [x + 16, 0], [x + 16, h], [x, h]], C.sailR, { alpha: 0.55, grain: false }); }))); furl.rotation.z = Math.PI / 2; furl.position.set(0, -0.3, 0); yardRig.add(furl);
const rigMat = new THREE.LineBasicMaterial({ color: 0x5a4632 });
const rig = [];
for (const [x, z] of [[0, -SHIP.Lh - 0.9], [0, SHIP.Lh + 0.9], [2.4, mastZ + 1.2], [-2.4, mastZ + 1.2]]) {
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, deck0 + MAST_H - 0.3, mastZ), new THREE.Vector3(x, x ? H.pt(midU + 0.1, 1).y : SHIP.Y0 + 4.2, z)]), rigMat); scene.add(l); rig.push(l);
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
const chestTex = paintTex(256, 192, 541, (P, c, w, h) => { P.shape([[4, 4], [w - 4, 4], [w - 4, h - 4], [4, h - 4]], C.oak, { alpha: 0.75 }); P.pencil([[4, h * 0.3], [w - 4, h * 0.3]], { w: 1.4 }); P.shape([[w * 0.45, h * 0.25], [w * 0.55, h * 0.25], [w * 0.55, h * 0.5], [w * 0.45, h * 0.5]], C.iron, { alpha: 0.8 }); });
for (const side of [1, -1]) for (let j = 0; j < 8; j++) {
  const u = -0.62 + (1.24 * j) / 7; if (side === 1 && j === 6) continue;
  const w = H.hb(u) * H.xs(H.deckS) - 0.45, ch = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.8), lam(chestTex));
  ch.position.set(side * w, H.deckY(u) + 0.23, u * SHIP.Lh); scene.add(ch);
}

// ---- small boat (one of three found in the mound) ----
const BOAT = { Lh: 3.0, B: 1.35, D: 0.62, Y0: 0.04, strakes: 5 };
const HB = makeHullFns(BOAT);
const boat = buildHull(BOAT, HB, hullMat, { nu: 40, t: 0.015, keelR: 0.05 });
boat.position.set(8.5, 0, -12.5); boat.rotation.y = 0.5; boat.rotation.z = 0.12; scene.add(boat);

export { SHIP, makeHullFns, H, plankTex, hullMat, buildHull, woodMat, rudderPivot, rudder, midU, mastZ, deck0, MAST_H, sail$, placeSail };
