import { canvas, renderer, camera, solids } from "./core.js";
import { reduceMotion } from "./util.js";
import { SHIP, H, sail$ } from "./ship.js";
import { v3 } from "./cast.js";
import { T, STOPS } from "./stops.js";
import { state, hooks, flyTo, setOnBoard, ray } from "./controls.js";

const $ = (id) => document.getElementById(id);

// ---------------- markers ----------------
const markersEl = $("markers");
STOPS.forEach((s, i) => {
  const b = document.createElement("button"); b.className = "marker"; b.textContent = i + 1;
  b.setAttribute("aria-label", `Stop ${i + 1}: ${s.title}`);
  const l = document.createElement("span"); l.className = "lbl"; l.textContent = s.title; b.appendChild(l);
  b.addEventListener("click", () => goToStop(i)); markersEl.appendChild(b); s.el = b;
});

// project anchors, hide the ones behind the ship
function updateMarkers() {
  const w = innerWidth, h = innerHeight;
  STOPS.forEach((s) => {
    const p = s.anchor(); const q = p.clone().project(camera);
    const visible = q.z < 1 && Math.abs(q.x) < 1.1 && Math.abs(q.y) < 1.1 && camera.position.distanceTo(p) < 70;
    s.el.style.display = visible ? "" : "none"; if (!visible) return;
    s.el.style.left = `${((q.x + 1) / 2) * w}px`; s.el.style.top = `${((1 - q.y) / 2) * h}px`;
    ray.set(camera.position, p.clone().sub(camera.position).normalize()); const hit = ray.intersectObjects(solids, false)[0];
    if (hit && hit.distance < camera.position.distanceTo(p) - 0.6) s.el.style.display = "none";
  });
}

// ---------------- stop panel ----------------
const panel = $("panel");
let current = -1;
const tagHtml = (tags, sep = "") => tags.map((t) => `<span class="tag ${T[t][0]}">${T[t][1]}</span>`).join(sep);
function goToStop(i) {
  const s = STOPS[i]; current = i;
  const look = s.view.look(), onBoard = !!s.view.board;
  flyTo(s.view.pos, look, onBoard);
  state.visited.add(s.id); s.el.classList.add("visited");
  $("progress").textContent = `${state.visited.size} of ${STOPS.length} stops`;
  $("pTags").innerHTML = tagHtml(s.tags);
  $("pTitle").textContent = `${i + 1}. ${s.title}`;
  $("pBody").innerHTML = s.body + `<p class="notice"><strong>Notice:</strong> ${s.notice}</p>`;
  const ex = $("pExtra"); ex.hidden = s.extra !== "sail"; ex.textContent = sail$.target ? "Lower the sail" : "Raise the sail";
  panel.hidden = false; $("pTitle").focus?.();
  history.replaceState(null, "", `#stop=${i + 1}`);
}
function nextStop() { for (let k = 1; k <= STOPS.length; k++) { const j = (current + k) % STOPS.length; if (!state.visited.has(STOPS[j].id) || state.visited.size === STOPS.length) return goToStop(j); } }
$("guide").onclick = nextStop;
$("pNext").onclick = nextStop;
$("pClose").onclick = () => { panel.hidden = true; };

function setSailLabel() { const t = sail$.target ? "Lower the sail" : "Raise the sail"; $("sailBtn").textContent = t; $("pExtra").textContent = t; }
function toggleSail() { sail$.target = sail$.target ? 0 : 1; setSailLabel(); if (reduceMotion) sail$.amt = sail$.target; }
$("sailBtn").onclick = toggleSail;
$("pExtra").onclick = toggleSail;

function updateBoardBtn() { $("board").textContent = state.onBoard ? "Step ashore" : "Board the ship"; }
hooks.onBoardChange = updateBoardBtn;
$("board").onclick = () => {
  if (state.onBoard) flyTo(v3(7.5, 1.65, 2), v3(0, 2, 0), false);
  else flyTo(v3(0.6, H.deckY(0.55) + 1.65, 0.55 * SHIP.Lh), v3(0, H.deckY(-0.6) + 1.3, -0.7 * SHIP.Lh), true);
};
$("overview").onclick = () => { setOnBoard(false); flyTo(v3(17, 11, 17), v3(-2, 0.5, 0), false, 2); };

// ---------------- text version and dialogs ----------------
$("textStops").innerHTML = STOPS.map((s, i) => `<h2>${i + 1}. ${s.title}</h2><p>${tagHtml(s.tags, " ")}</p>${s.body}<p><strong>Notice:</strong> ${s.notice}</p>`).join("");
function openModal(id) { $(id).hidden = false; document.querySelector(`#${id} .close`)?.focus(); }
$("textBtn").onclick = () => openModal("textModal");
$("aboutBtn").onclick = () => openModal("aboutModal");
document.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => ($(b.dataset.close).hidden = true)));
$("start").onclick = () => { $("intro").hidden = true; canvas.focus(); };
addEventListener("keydown", (e) => { if (e.key === "Escape") { document.querySelectorAll(".modal-back").forEach((m) => (m.hidden = true)); panel.hidden = true; } });

// ---------------- resize ----------------
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();

export { goToStop, updateMarkers, updateBoardBtn, setSailLabel };
