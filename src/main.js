import "@fontsource/spectral/400.css";
import "@fontsource/spectral/600.css";
import "@fontsource/spectral/700.css";
import "@fontsource/source-sans-3/400.css";
import "@fontsource/source-sans-3/600.css";
import "./styles.css";
import * as THREE from "three";
import { clamp, lerp, rngFrom } from "./util.js";
import { renderer, scene, camera } from "./core.js";
import { SHIP, H, rudder, sail$, placeSail } from "./ship.js";
import { waterTex, foamTex, foam, smoke, gulls, gullTex } from "./world.js";
import { v3, cast, fireSpot, OAR_PATH } from "./cast.js";
import { STOPS } from "./stops.js";
import { state, lookAtPoint, updateMovement } from "./controls.js";
import { goToStop, updateMarkers, updateBoardBtn, setSailLabel } from "./ui.js";

// ---------------- loop ----------------
const clock = new THREE.Clock(); let time = 0;
function frame() {
  const dt = Math.min(0.05, clock.getDelta()); time += dt;
  updateMovement(dt);
  // life
  const op = OAR_PATH, span = op.z1 - op.z0, cyc = (time * op.speed) % (2 * span), forward = cyc < span;
  cast.oars.mesh.position.set(op.x, 0, forward ? op.z0 + cyc : op.z1 - (cyc - span));
  cast.oars.face = cast.oars.mesh.position.clone().add(v3(0, 0, forward ? 5 : -5));
  const dogA = time * 0.35; cast.dog.mesh.position.set(-8.6 + Math.cos(dogA) * 3.2, 0, -1 + Math.sin(dogA) * 2.2); cast.dog.face = cast.dog.mesh.position.clone().add(v3(-Math.sin(dogA), 0, Math.cos(dogA)));
  for (const a of Object.values(cast)) a.update(time, camera);
  smoke.forEach((s, i) => { const life = 6, age = (time + (i * life) / smoke.length) % life, f = age / life; s.position.set(fireSpot.x + age * 0.35 + Math.sin(i + age) * 0.15, fireSpot.y + age * 0.9, fireSpot.z - age * 0.1); const sc = lerp(0.5, 2.6, f); s.scale.set(sc, sc, 1); s.material.opacity = 0.7 * Math.sin(Math.PI * Math.min(1, f * 1.3 + 0.05)) * (1 - f); });
  gulls.forEach((g, i) => { const R = rngFrom(700 + i), a = time * (0.12 + R() * 0.05) + i; g.position.set(Math.cos(a) * (25 + R() * 15) - 5, 16 + R() * 8 + Math.sin(time + i) * 0.5, Math.sin(a) * (20 + R() * 10) - 25); g.material.map = gullTex[Math.floor(time * 5 + i) % 2]; });
  waterTex.offset.set(time * 0.004, time * 0.002); foamTex.offset.x = Math.sin(time * 0.6) * 0.02; foam.position.z = -16.2 + Math.sin(time * 0.7) * 0.25;
  sail$.amt += (sail$.target - sail$.amt) * Math.min(1, dt * 1.2); placeSail(sail$.amt);
  rudder.rotation.y = Math.sin(time * 0.25) * 0.05;
  updateMarkers();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// deep links such as #stop=3 open a stop directly (useful from a Canvas page)
if (location.hash.includes("sail")) { sail$.target = 1; sail$.amt = 1; setSailLabel(); }
const m = location.hash.match(/stop=(\d+)/);
document.getElementById("loader").hidden = true;
if (location.hash.includes("deck")) { document.getElementById("intro").hidden = true; state.onBoard = true; updateBoardBtn(); camera.position.set(0.6, H.deckY(0.55) + 1.65, 0.55 * SHIP.Lh); lookAtPoint(v3(0, H.deckY(-0.6) + 1.3, -0.7 * SHIP.Lh)); }
if (m) { document.getElementById("intro").hidden = true; const i = clamp(parseInt(m[1], 10) - 1, 0, STOPS.length - 1); goToStop(i); if (state.flight) { camera.position.copy(state.flight.to.p); state.yaw = state.flight.to.yaw; state.pitch = state.flight.to.pitch; state.flight = null; } }
window.__ready = true;
requestAnimationFrame(frame);
