import * as THREE from "three";
import { TAU, clamp, lerp } from "./util.js";
import { ell, paintTex } from "./painter.js";
import { scene, lam, basic, solids } from "./core.js";
import { SHIP, H, woodMat } from "./ship.js";

// ---- landscape ----
const groundTex = paintTex(1024, 1024, 601, (P, c, w, h) => {
  c.fillStyle = "#e2cc9c"; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) P.wash(ell(P.rr(0, w), P.rr(0, h), P.rr(60, 180), P.rr(30, 90), 26, P.rr(0, 3)), P.r() < 0.5 ? "#cdb07c" : "#efdcb4", { alpha: 0.18, edge: 0.1, grain: false, jit: 10 });
  for (let i = 0; i < 60; i++) { const x = P.rr(10, w - 10), y = P.rr(10, h - 10), r = P.rr(2, 5); P.shape(ell(x, y, r, r * 0.6, 10), "#c9b48f", { alpha: 0.45, pen: { w: 0.6, alpha: 0.3 } }); }
  c.fillStyle = "#3b2a1a"; for (let i = 0; i < 8000; i++) { c.globalAlpha = P.rr(0.03, 0.07); c.fillRect(P.rr(0, w), P.rr(0, h), 1.5, 1.5); }
}, [40, 40]);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), lam(groundTex)); ground.rotation.x = -Math.PI / 2; ground.position.z = 380; scene.add(ground);
const grassTex = paintTex(1024, 1024, 602, (P, c, w, h) => {
  c.fillStyle = "#9aa463"; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 30; i++) P.wash(ell(P.rr(0, w), P.rr(0, h), P.rr(60, 160), P.rr(30, 80), 26, P.rr(0, 3)), P.r() < 0.5 ? "#7f8a4e" : "#b3b877", { alpha: 0.22, edge: 0.1, grain: false, jit: 10 });
  for (let i = 0; i < 260; i++) { const x = P.rr(10, w - 10), y = P.rr(10, h - 10); for (let j = 0; j < 3; j++) P.pencil([[x + j * 3, y], [x + j * 3 + P.rr(-4, 4), y - P.rr(6, 12)]], { w: 0.8, color: "#5b6a33", alpha: 0.6, passes: 1 }); }
}, [30, 30]);
const grassEdge = paintTex(1024, 256, 603, (P, c, w, h) => { const pts = [[0, h]]; for (let x = 0; x <= w; x += 32) pts.push([x, P.rr(10, 90)]); pts.push([w, h]); P.wash(pts, "#9aa463", { alpha: 0.9, edge: 0.4, jit: 6 }); });
const grass = new THREE.Mesh(new THREE.PlaneGeometry(800, 600), lam(grassTex)); grass.rotation.x = -Math.PI / 2; grass.position.set(0, 0.02, 322); scene.add(grass);
const ge = new THREE.Mesh(new THREE.PlaneGeometry(800, 12), lam(grassEdge, { transparent: true, depthWrite: false })); ge.rotation.x = -Math.PI / 2; ge.position.set(0, 0.025, 16); ge.material.map.repeat.set(30, 1); ge.material.map.wrapS = THREE.RepeatWrapping; scene.add(ge);
// rollers under the keel
for (const u of [-0.55, -0.15, 0.25, 0.6]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.4, 10), woodMat); r.rotation.z = Math.PI / 2; r.position.set(0, 0.2 + H.keelY(u) * 0.5, u * SHIP.Lh); scene.add(r); }
// sea
const waterTex = paintTex(1024, 1024, 611, (P, c, w, h) => {
  c.fillStyle = "#7fa2ad"; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) P.wash(ell(P.rr(0, w), P.rr(0, h), P.rr(80, 200), P.rr(10, 30), 26), P.r() < 0.5 ? "#6a8f9c" : "#a9c3c6", { alpha: 0.2, edge: 0, grain: false, jit: 8 });
  for (let i = 0; i < 180; i++) { const x = P.rr(0, w), y = P.rr(0, h); P.pencil([[x, y], [x + 14, y - 4], [x + 28, y]], { w: 1, color: "#eef4f2", alpha: 0.55, passes: 1 }); }
}, [24, 24]);
const water = new THREE.Mesh(new THREE.PlaneGeometry(1200, 600), basic(waterTex)); water.rotation.x = -Math.PI / 2; water.position.set(0, 0.06, -316); scene.add(water);
const foamTex = paintTex(1024, 128, 612, (P, c, w, h) => { for (let x = 0; x < w; x += 40) P.wash(ell(x + 20, h / 2, P.rr(30, 50), P.rr(10, 22), 16), "#f4f1e6", { alpha: 0.5, grain: false, edge: 0.2, jit: 5 }); }, [40, 1]);
const foam = new THREE.Mesh(new THREE.PlaneGeometry(1200, 3), basic(foamTex, { transparent: true, depthWrite: false })); foam.rotation.x = -Math.PI / 2; foam.position.set(0, 0.08, -16.2); scene.add(foam);
// sky and fjord mountains
const skyTex = paintTex(2048, 1024, 621, (P, c, w, h) => {
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#9fbfcd"); g.addColorStop(0.6, "#d7e3df"); g.addColorStop(1, "#f1e8d2"); c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 14; i++) P.wash(ell(P.rr(0, w), P.rr(80, 600), P.rr(120, 280), P.rr(24, 50), 36, 0, 0.12, 7), "#fbf7ee", { alpha: 0.35, edge: 0.25, grain: false, jit: 6 });
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16, 0, TAU, 0, Math.PI / 2), basic(skyTex, { side: THREE.BackSide, fog: false })); scene.add(sky);
function mountainTex(seed, col, colD, peaks) {
  return paintTex(2048, 512, seed, (P, c, w, h) => {
    const pts = [[0, h]]; let y = h * 0.5;
    for (let x = 0; x <= w; x += 32) { let pk = 0; for (const p of peaks) pk = Math.max(pk, Math.exp(-Math.pow((x - w * p) / (w * 0.07), 2))); y = clamp(y + P.rr(-22, 22), h * 0.3, h * 0.7); pts.push([x, lerp(y, h * 0.05, pk)]); }
    pts.push([w, h]); P.shape(pts, col, { alpha: 0.55, jit: 4, pen: { w: 1.4, alpha: 0.5 } });
    for (let i = 0; i < 20; i++) { const x = P.rr(0, w); P.wash([[x, h * 0.25], [x + P.rr(40, 120), h], [x - P.rr(20, 80), h]], colD, { alpha: 0.2, grain: false, edge: 0.1, jit: 8 }); }
    for (let i = 0; i < 90; i++) { const x = P.rr(0, w), yy = P.rr(h * 0.6, h * 0.95); P.wash([[x, yy - 26], [x + 9, yy], [x - 9, yy]], "#4f6046", { alpha: 0.5, grain: false, edge: 0 }); }
  });
}
for (const [x, z, w, hgt, seed, col, colD, pk] of [[-230, -330, 700, 150, 631, "#8f9a92", "#6f7c78", [0.3, 0.7]], [260, -360, 760, 170, 632, "#97a09a", "#77827f", [0.2, 0.55]], [0, -520, 1200, 160, 633, "#b6bdb9", "#9aa3a2", [0.4, 0.75]]]) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), basic(mountainTex(seed, col, colD, pk), { transparent: true, fog: false, depthWrite: false })); m.position.set(x, hgt / 2 - 6, z); scene.add(m);
}
// tent of the camp (parts of a tent were found in the mound)
{
  const tTex = paintTex(512, 512, 641, (P, c, w, h) => { P.wash([[0, 0], [w, 0], [w, h], [0, h]], "#d8c8a0", { alpha: 0.85, edge: 0 }); for (let x = 0; x < w; x += 64) P.wash([[x, 0], [x + 24, 0], [x + 24, h], [x, h]], "#b9a477", { alpha: 0.35, grain: false }); });
  const tent = new THREE.Group(), len = 5, half = 1.6, ht = 2.4;
  for (const sd of [1, -1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(len, Math.hypot(half, ht)), lam(tTex, { side: THREE.DoubleSide })); m.position.set(sd * half / 2, ht / 2, 0); m.rotation.y = Math.PI / 2; m.rotation.x = 0; m.rotateX(sd * -Math.atan2(half, ht)); tent.add(m); }
  const gable = new THREE.Shape([new THREE.Vector2(-half, 0), new THREE.Vector2(half, 0), new THREE.Vector2(0, ht)]);
  const gm = new THREE.Mesh(new THREE.ShapeGeometry(gable), lam(tTex, { color: 0xbfae88, side: THREE.DoubleSide })); gm.position.z = len / 2 - 0.01; tent.add(gm);
  const door = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 1.5)])), basic(null, { color: 0x3a2c22 })); door.position.z = len / 2; tent.add(door);
  const gb = new THREE.Mesh(new THREE.ShapeGeometry(gable), lam(tTex, { color: 0xbfae88, side: THREE.DoubleSide })); gb.position.z = -len / 2; tent.add(gb);
  for (const z of [len / 2 + 0.05, -len / 2 - 0.05]) for (const sd of [1, -1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.1, 0.08), woodMat); b.position.set(sd * 0.55, 1.35, z); b.rotation.z = sd * 0.42; tent.add(b); }
  tent.position.set(-11.5, 0, 7); tent.rotation.y = 0.5; scene.add(tent); solids.push(...tent.children);
}
// smoke from the cook fire
const puffTex = [0, 1, 2].map((j) => paintTex(256, 256, 650 + j, (P, c, w) => { for (let i = 0; i < 4; i++) P.wash(ell(w / 2 + P.rr(-25, 25), w / 2 + P.rr(-25, 25), P.rr(60, 100), P.rr(50, 90), 28, 0, 0.1, 5), i % 2 ? "#a7adb1" : "#d4d6d4", { alpha: 0.3, edge: 0.3, grain: false, jit: 8 }); }));
const smoke = []; for (let i = 0; i < 10; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex[i % 3], transparent: true, depthWrite: false })); scene.add(s); smoke.push(s); }
// gulls
const gullTex = [0, 1].map((j) => paintTex(128, 64, 660 + j, (P) => P.pencil([[6, j ? 18 : 46], [34, 36], [64, 42], [94, 36], [122, j ? 18 : 46]], { w: 4, color: "#4a4440" })));
const gulls = []; for (let i = 0; i < 6; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: gullTex[0], transparent: true, depthWrite: false, fog: false })); s.scale.set(1.2, 0.6, 1); scene.add(s); gulls.push(s); }

export { ground, grass, waterTex, foamTex, foam, smoke, gulls, gullTex };
