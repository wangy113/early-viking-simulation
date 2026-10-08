import * as THREE from "three";
import { scene } from "./core.js";
import { Actor } from "./actors.js";
import { SHIP, H, rudderPivot, mastZ, deck0 } from "./ship.js";

// ---------------- cast ----------------
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const hullOut = (u, s, side, d) => { const p = H.pt(u, s, side), n = H.normal(u, s, side); n.y = 0; n.normalize(); return p.addScaledVector(n, d); };
function onGround(p) { p.y = 0; return p; }
const cast = {};
function addActor(name, key, seed, pos, opts = {}) { const a = new Actor(key, seed, opts); a.mesh.position.copy(pos); scene.add(a.mesh); cast[name] = a; return a; }
addActor("wright", "wright", 11, onGround(hullOut(0.08, 0.46, 1, 0.5)), { face: H.pt(0.08, 0.46, 1) });
addActor("caulk", "caulk", 12, onGround(hullOut(-0.3, 0.36, -1, 0.55)), { face: H.pt(-0.3, 0.36, -1) });
addActor("oars", "oars", 13, v3(8, 0, 0));
addActor("shield", "shield", 14, v3(H.hb(0.38) * H.xs(H.deckS) - 0.75, H.deckY(0.38) + 0.02, 0.38 * SHIP.Lh), { face: H.pt(0.38, 1, 1) });
addActor("steer", "steer", 15, v3(H.hb(0.74) * H.xs(H.deckS) - 0.95, H.deckY(0.74) + 0.02, 0.74 * SHIP.Lh), { face: rudderPivot });
addActor("rope", "rope", 16, v3(0.45, deck0 + 0.02, mastZ + 0.3), { face: v3(0, deck0 + 3, mastZ) });
addActor("chest", "chest", 17, onGround(hullOut(0.32, 0.6, -1, 1.15)), { face: H.pt(0.32, 1, -1) });
addActor("game", "game", 18, v3(-8.2, 0, 2.2));
addActor("cook", "cook", 19, v3(-9.6, 0, -2.6), { face: v3(-8.9, 0, -2.6) });
addActor("horse", "horse", 20, v3(-14, 0, 13), { phase: 0.3 });
addActor("dog", "dog", 21, v3(-8, 0, -4));
const fireSpot = v3(-8.95, 0.9, -2.6);
const OAR_PATH = { x: 8.2, z0: -11, z1: 9, speed: 1.2 };

export { v3, hullOut, cast, fireSpot, OAR_PATH };
