import * as THREE from "three";
import { scene, solids } from "./core.js";
import { Actor } from "./people.js";
import { SHIP, H, rudderPivot, rudder, mastZ, deck0 } from "./ship.js";

// ---------------- cast ----------------
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const hullOut = (u, s, side, d) => { const p = H.pt(u, s, side), n = H.normal(u, s, side); n.y = 0; n.normalize(); return p.addScaledVector(n, d); };
function onGround(p) { p.y = 0; return p; }
const cast = {};
// Horizontal distance from a spot to the hull, toward `face`, at height y. People working on
// the hull use it to place their tools on the planks.
const ray = new THREE.Raycaster();
function hullReach(pos, face) {
  scene.updateMatrixWorld(true);
  const dir = face.clone().sub(pos); dir.y = 0; dir.normalize();
  const at = (y) => { ray.set(new THREE.Vector3(pos.x, y, pos.z), dir); ray.far = 6; const h = ray.intersectObjects(solids, false)[0]; return h ? h.distance : 6; };
  const ys = Array.from({ length: 23 }, (_, i) => 0.2 + i * 0.1), d = ys.map(at);
  return (y) => { const f = THREE.MathUtils.clamp((y - 0.2) / 0.1, 0, 21.999), i = Math.floor(f); return d[i] + (d[i + 1] - d[i]) * (f - i); };
}
function addActor(name, key, _seed, pos, opts = {}) {
  // standOff: [height, distance] moves the spot so the hull is exactly that far away at that height
  if (opts.standOff && opts.face) {
    const [h, want] = opts.standOff, dir = opts.face.clone().sub(pos); dir.y = 0; dir.normalize();
    pos = pos.clone().addScaledVector(dir, hullReach(pos, opts.face)(h) - want);
  }
  if (opts.face) opts.reach = hullReach(pos, opts.face);
  const a = new Actor(key, opts); a.mesh.position.copy(pos); scene.add(a.mesh); cast[name] = a; return a;
}
addActor("wright", "wright", 11, onGround(hullOut(0.08, 0.46, 1, 0.82)), { face: H.pt(0.08, 0.46, 1), standOff: [1.15, 0.6] });
addActor("caulk", "caulk", 12, onGround(hullOut(-0.3, 0.36, -1, 0.55)), { face: H.pt(-0.3, 0.36, -1), standOff: [0.8, 0.82] });
addActor("oars", "oars", 13, v3(8, 0, 0));
addActor("shield", "shield", 14, v3(H.hb(0.38) * H.xs(H.deckS) - 0.75, H.deckY(0.38) + 0.02, 0.38 * SHIP.Lh), { face: H.pt(0.38, 1, 1) });
// the steersman stands just forward of the tiller's inboard end, within reach of it
rudder.updateMatrixWorld(true);
const tillerEnd = rudder.localToWorld(v3(-1.22, 0.15, 0)), steerZ = tillerEnd.z - 0.28;
addActor("steer", "steer", 15, v3(tillerEnd.x - 0.1, H.deckY(steerZ / SHIP.Lh) + 0.02, steerZ), { face: rudderPivot });
addActor("rope", "rope", 16, v3(0.45, deck0 + 0.02, mastZ + 0.3), { face: v3(0, deck0 + 3, mastZ) });
addActor("chest", "chest", 17, onGround(hullOut(0.32, 0.6, -1, 1.15)), { face: H.pt(0.32, 1, -1), deckLift: H.deckY(0.32) + 0.02 });
addActor("game", "game", 18, v3(-8.2, 0, 2.2));
addActor("cook", "cook", 19, v3(-9.6, 0, -2.6), { face: v3(-8.9, 0, -2.6) });
addActor("horse", "horse", 20, v3(-14, 0, 13), { phase: 0.3 });
addActor("dog", "dog", 21, v3(-8, 0, -4));
const fireSpot = v3(-8.95, 0.9, -2.6);
const OAR_PATH = { x: 8.2, z0: -11, z1: 9, speed: 1.2 };

export { v3, hullOut, cast, fireSpot, OAR_PATH };
