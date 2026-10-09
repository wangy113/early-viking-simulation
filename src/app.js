import * as THREE from "three";
import { clamp, lerp } from "./util.js";
import { renderer, scene, camera, canvas, TIER } from "./core.js";
import { SHIP, H, rudder, sail$, placeSail } from "./ship.js";
import { smoke, updateWorld } from "./world.js";
import { v3, cast, fireSpot, OAR_PATH } from "./cast.js";
import { STOPS } from "./stops.js";
import { state, lookAtPoint, updateMovement } from "./controls.js";
import { goToStop, updateMarkers, updateBoardBtn, setSailLabel } from "./ui.js";

// ?debug shows frame rate, draw calls and triangles, and exposes them as window.__stats for tests
const debug = new URLSearchParams(location.search).has("debug") ? (() => {
  const el = document.createElement("div"); el.setAttribute("aria-hidden", "true");
  el.style.cssText = "position:fixed;left:8px;top:70px;z-index:30;background:rgba(0,0,0,.65);color:#fff;font:12px/1.4 monospace;padding:6px 8px;border-radius:6px;pointer-events:none";
  document.body.appendChild(el); let acc = 0, n = 0;
  return { tick(dt) { acc += dt; n++; if (acc >= 0.5) { const i = renderer.info.render; window.__stats = { fps: n / acc, calls: i.calls, triangles: i.triangles, dpr: renderer.getPixelRatio() }; el.textContent = `${(n / acc).toFixed(1)} fps  ${i.calls} draws  ${(i.triangles / 1000).toFixed(0)}k tris  dpr ${renderer.getPixelRatio().toFixed(2)}`; acc = 0; n = 0; } } };
})() : null;

// ---------------- loop ----------------
const clock = new THREE.Clock(); let time = 0;
// pause when the scene is scrolled out of view, for example in a Canvas page
let onScreen = true;
new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(canvas);
// lower the resolution step by step when frames are slow, and raise it again when there is room
const baseDpr = renderer.getPixelRatio(); let slow = 0, fast = 0;
function adaptResolution(dt) {
  if (dt > 1 / 24) { slow++; fast = 0; } else if (dt < 1 / 50) { fast++; slow = 0; } else { slow = Math.max(0, slow - 1); fast = Math.max(0, fast - 1); }
  const dpr = renderer.getPixelRatio();
  if (slow > 45 && dpr > baseDpr * 0.6) { renderer.setPixelRatio(Math.max(baseDpr * 0.6, dpr - 0.15)); slow = 0; }
  if (fast > 180 && dpr < baseDpr) { renderer.setPixelRatio(Math.min(baseDpr, dpr + 0.15)); fast = 0; }
}
void TIER;
function frame() {
  const dt = Math.min(0.05, clock.getDelta()); time += dt;
  if (!onScreen || document.hidden) { requestAnimationFrame(frame); return; }
  adaptResolution(clock.elapsedTime > 3 ? dt : 0.02);
  updateMovement(dt);
  // life
  const op = OAR_PATH, span = op.z1 - op.z0, cyc = (time * op.speed) % (2 * span), forward = cyc < span;
  cast.oars.mesh.position.set(op.x, 0, forward ? op.z0 + cyc : op.z1 - (cyc - span));
  cast.oars.face = cast.oars.mesh.position.clone().add(v3(0, 0, forward ? 5 : -5));
  const dogA = time * 0.35; cast.dog.mesh.position.set(-8.6 + Math.cos(dogA) * 3.2, 0, -1 + Math.sin(dogA) * 2.2); cast.dog.face = cast.dog.mesh.position.clone().add(v3(-Math.sin(dogA), 0, Math.cos(dogA)));
  for (const a of Object.values(cast)) a.update(time, camera);
  smoke.forEach((s, i) => { const life = 6, age = (time + (i * life) / smoke.length) % life, f = age / life; s.position.set(fireSpot.x + age * 0.35 + Math.sin(i + age) * 0.15, fireSpot.y + age * 0.9, fireSpot.z - age * 0.1); const sc = lerp(0.5, 2.6, f); s.scale.set(sc, sc, 1); s.material.opacity = 0.7 * Math.sin(Math.PI * Math.min(1, f * 1.3 + 0.05)) * (1 - f); });
  updateWorld(time, dt);
  sail$.amt += (sail$.target - sail$.amt) * Math.min(1, dt * 1.2); placeSail(sail$.amt);
  rudder.rotation.y = Math.sin(time * 0.25) * 0.05;
  updateMarkers();
  renderer.render(scene, camera);
  if (debug) debug.tick(dt);
  requestAnimationFrame(frame);
}

// deep links such as #stop=3 open a stop directly (useful from a Canvas page)
if (location.hash.includes("sail")) { sail$.target = 1; sail$.amt = 1; setSailLabel(); }
const m = location.hash.match(/stop=(\d+)/);
if (location.hash.includes("deck")) { document.getElementById("intro").hidden = true; state.onBoard = true; updateBoardBtn(); camera.position.set(0.6, H.deckY(0.55) + 1.65, 0.55 * SHIP.Lh); lookAtPoint(v3(0, H.deckY(-0.6) + 1.3, -0.7 * SHIP.Lh)); }
// #cam=x,y,z,lookX,lookY,lookZ places the camera directly (for preview screenshots)
const camLink = location.hash.match(/cam=([-\d.,]+)/);
if (camLink) { const n = camLink[1].split(",").map(Number); if (n.length === 6) { document.getElementById("intro").hidden = true; camera.position.set(n[0], n[1], n[2]); lookAtPoint(v3(n[3], n[4], n[5])); } }
if (location.hash.includes("overview")) { document.getElementById("intro").hidden = true; camera.position.set(17, 11, 17); lookAtPoint(v3(-2, 0.5, 0)); }
if (m) { document.getElementById("intro").hidden = true; const i = clamp(parseInt(m[1], 10) - 1, 0, STOPS.length - 1); goToStop(i); if (state.flight) { camera.position.copy(state.flight.to.p); state.yaw = state.flight.to.yaw; state.pitch = state.flight.to.pitch; state.flight = null; } }
window.__ready = true;
if (debug) { window.__scene = scene; window.__cast = cast; }
requestAnimationFrame(frame);
