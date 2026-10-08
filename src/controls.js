import * as THREE from "three";
import { clamp, lerp, reduceMotion } from "./util.js";
import { canvas, camera, solids } from "./core.js";
import { SHIP, H } from "./ship.js";
import { ground, grass } from "./world.js";
import { v3 } from "./cast.js";

// ---------------- camera, movement ----------------
const state = { yaw: 0, pitch: 0, onBoard: false, visited: new Set(), flight: null, walkTo: null };
const hooks = { onBoardChange: () => {} };
camera.position.set(10.5, 1.65, -9.5);
function lookAtPoint(p) { const d = p.clone().sub(camera.position); state.yaw = Math.atan2(-d.x, -d.z); state.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); }
lookAtPoint(v3(0, 1.8, 0));
function applyLook() { camera.rotation.set(state.pitch, state.yaw, 0, "YXZ"); }

function deckBounds(p) { const u = p.z / SHIP.Lh; if (Math.abs(u) > 0.8) return null; return { u, w: H.hb(u) * H.xs(H.deckS) - 0.35 }; }
function insideHull(p, pad = 0.6) { const u = p.z / SHIP.Lh; if (Math.abs(u) > 1.08) return false; return Math.abs(p.x) < H.hb(clamp(u, -1, 1)) + pad; }
function groundHeight(p) {
  if (state.onBoard) { const b = deckBounds(p); return b ? H.deckY(b.u) + 1.65 : 1.65; }
  return 1.65;
}
function constrain(p, prev) {
  if (state.onBoard) {
    p.z = clamp(p.z, -0.78 * SHIP.Lh, 0.78 * SHIP.Lh);
    const b = deckBounds(p); p.x = clamp(p.x, -b.w, b.w);
  } else if (insideHull(p)) { p.x = prev.x; p.z = prev.z; if (insideHull(p)) p.x += Math.sign(p.x || 1) * 0.2; }
  if (p.z < -16) p.z = -16;
  p.y = groundHeight(p);
}

function setOnBoard(v) { state.onBoard = v; hooks.onBoardChange(); }
function flyTo(pos, look, onBoard, dur = 1.6) {
  state.walkTo = null;
  const from = { p: camera.position.clone(), yaw: state.yaw, pitch: state.pitch };
  const tmp = camera.position.clone(); camera.position.copy(pos); lookAtPoint(look); const to = { p: pos.clone(), yaw: state.yaw, pitch: state.pitch }; camera.position.copy(tmp); state.yaw = from.yaw; state.pitch = from.pitch;
  let dy = to.yaw - from.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); to.yaw = from.yaw + dy;
  setOnBoard(onBoard);
  if (reduceMotion) { camera.position.copy(to.p); state.yaw = to.yaw; state.pitch = to.pitch; return; }
  state.flight = { from, to, t: 0, dur };
}

function move(fwd, side) {
  state.flight = null; state.walkTo = null;
  const prev = camera.position.clone();
  const f = v3(-Math.sin(state.yaw), 0, -Math.cos(state.yaw)), r = v3(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
  camera.position.addScaledVector(f, fwd).addScaledVector(r, side); constrain(camera.position, prev);
}

// look with drag, click to walk
let drag = null;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, yaw: state.yaw, pitch: state.pitch, moved: 0 }; canvas.setPointerCapture(e.pointerId); canvas.classList.add("dragging"); });
canvas.addEventListener("pointermove", (e) => {
  if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
  if (drag.moved > 4) { state.flight = null; state.yaw = drag.yaw + dx * 0.004; state.pitch = clamp(drag.pitch + dy * 0.004, -1.2, 1.2); }
});
canvas.addEventListener("pointerup", (e) => {
  canvas.classList.remove("dragging");
  if (drag && drag.moved <= 4) {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects([ground, grass, ...solids], false)[0];
    if (hit) {
      const p = hit.point.clone();
      if (state.onBoard && deckBounds(p)) state.walkTo = p;
      else if (!state.onBoard && hit.object !== ground && hit.object !== grass && hit.point.y > 1 && deckBounds(p) && insideHull(p, 0)) { flyTo(v3(p.x, H.deckY(p.z / SHIP.Lh) + 1.65, p.z), p.clone().add(v3(0, 1, -3)), true, 1.2); }
      else if (!state.onBoard) state.walkTo = p;
    }
  }
  drag = null;
});
canvas.addEventListener("wheel", (e) => { e.preventDefault(); move(e.deltaY < 0 ? 1.2 : -1.2, 0); }, { passive: false });
const keys = new Set();
addEventListener("keydown", (e) => { if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return; const k = e.key.toLowerCase(); if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(k)) { keys.add(k); if (k.startsWith("arrow")) e.preventDefault(); } });
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
const padHeld = new Set();
document.querySelectorAll("[data-move]").forEach((b) => { const m = b.dataset.move; b.addEventListener("pointerdown", () => padHeld.add(m)); for (const ev of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(ev, () => padHeld.delete(m)); b.addEventListener("click", (e) => { if (e.detail === 0) { if (m === "f") move(1, 0); if (m === "b") move(-1, 0); if (m === "l") state.yaw += 0.25; if (m === "r") state.yaw -= 0.25; } }); });

// per-frame movement: keys, move pad, click-to-walk and camera flights
const tmpV = new THREE.Vector3();
function updateMovement(dt) {
  const fwd = (keys.has("w") || keys.has("arrowup") || padHeld.has("f") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") || padHeld.has("b") ? 1 : 0);
  const turn = (keys.has("a") || keys.has("arrowleft") || padHeld.has("l") ? 1 : 0) - (keys.has("d") || keys.has("arrowright") || padHeld.has("r") ? 1 : 0);
  if (fwd) move(fwd * dt * 3.2, 0);
  if (turn) { state.yaw += turn * dt * 1.6; state.flight = null; }
  if (state.walkTo) {
    const d = tmpV.copy(state.walkTo).sub(camera.position); d.y = 0; const dist = d.length();
    if (dist < 0.4) state.walkTo = null;
    else { const prev = camera.position.clone(); const step = Math.min(dist - 0.3, dt * 3.4); d.normalize(); camera.position.addScaledVector(d, step); constrain(camera.position, prev); if (camera.position.distanceTo(prev) < 0.001) state.walkTo = null; const ty = Math.atan2(-d.x, -d.z); let dy = ty - state.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); state.yaw += dy * Math.min(1, dt * 3); }
  }
  if (state.flight) {
    const F = state.flight; F.t += dt; const k = clamp(F.t / F.dur, 0, 1), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(F.from.p, F.to.p, e); camera.position.y += Math.sin(Math.PI * e) * (F.from.p.distanceTo(F.to.p) > 8 ? 1.5 : 0.3);
    state.yaw = lerp(F.from.yaw, F.to.yaw, e); state.pitch = lerp(F.from.pitch, F.to.pitch, e);
    if (k >= 1) state.flight = null;
  }
  applyLook();
}

export { state, hooks, lookAtPoint, applyLook, setOnBoard, flyTo, move, updateMovement, ray };
