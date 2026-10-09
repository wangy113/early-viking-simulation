import * as THREE from "three";
import { canvas, renderer, camera, solids, QUALITY, TIER } from "./core.js";
import { nextQuality } from "./quality.js";
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
// Markers are placed every frame, but only one is tested per frame for being hidden behind
// the ship, so a full round of hidden checks takes 12 frames. Ray casts are the costly part.
let checkNext = 0;
const tp = new THREE.Vector3(), tq2 = new THREE.Vector3();
function updateMarkers() {
  const w = innerWidth, h = innerHeight;
  STOPS.forEach((s, i) => {
    const p = tp.copy(s.anchor()), q = tq2.copy(p).project(camera), dist = camera.position.distanceTo(p);
    const visible = q.z < 1 && Math.abs(q.x) < 1.1 && Math.abs(q.y) < 1.1 && dist < 70;
    if (visible && i === checkNext) {
      ray.set(camera.position, p.clone().sub(camera.position).normalize()); ray.far = dist;
      const hit = ray.intersectObjects(solids, false)[0];
      s.hiddenBehind = !!(hit && hit.distance < dist - 0.6);
    }
    const show = visible && !s.hiddenBehind;
    s.el.style.display = show ? "" : "none"; if (!show) return;
    s.el.style.left = `${((q.x + 1) / 2) * w}px`; s.el.style.top = `${((1 - q.y) / 2) * h}px`;
  });
  checkNext = (checkNext + 1) % STOPS.length;
}

// ---------------- stop panel ----------------
const panel = $("panel");
let current = -1, panelOpener = null;
const tagHtml = (tags, sep = "") => tags.map((t) => `<span class="tag ${T[t][0]}">${T[t][1]}</span>`).join(sep);
function goToStop(i) {
  const s = STOPS[i]; current = i;
  // remember where focus was, so closing the stop can return there
  if (panel.hidden && document.activeElement && document.activeElement !== document.body) panelOpener = document.activeElement;
  const look = s.view.look(), onBoard = !!s.view.board;
  flyTo(s.view.pos, look, onBoard);
  state.visited.add(s.id); s.el.classList.add("visited");
  $("progress").textContent = `${state.visited.size} of ${STOPS.length} stops`;
  $("pTags").innerHTML = tagHtml(s.tags);
  $("pTitle").textContent = `${i + 1}. ${s.title}`;
  $("pBody").innerHTML = s.body + `<p class="notice"><strong>Notice:</strong> ${s.notice}</p>`;
  const ex = $("pExtra"); ex.hidden = s.extra !== "sail"; ex.textContent = sail$.target ? "Lower the sail" : "Raise the sail";
  panel.hidden = false; $("pTitle").focus({ preventScroll: true });
  renderStopList();
  history.replaceState(null, "", `#stop=${i + 1}`);
}
function nextStop() { for (let k = 1; k <= STOPS.length; k++) { const j = (current + k) % STOPS.length; if (!state.visited.has(STOPS[j].id) || state.visited.size === STOPS.length) return goToStop(j); } }
$("guide").onclick = nextStop;
$("pNext").onclick = nextStop;
function closePanel() {
  panel.hidden = true;
  const back = panelOpener && panelOpener.isConnected && panelOpener.offsetParent !== null ? panelOpener : $("guide");
  back.focus(); panelOpener = null;
}
$("pClose").onclick = closePanel;

function setSailLabel() { const t = sail$.target ? "Lower the sail" : "Raise the sail"; $("sailBtn").textContent = t; $("pExtra").textContent = t; }
function toggleSail() { sail$.target = sail$.target ? 0 : 1; setSailLabel(); if (reduceMotion || state.paused) sail$.amt = sail$.target; }
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
// Native dialogs trap focus and close with Escape. Focus goes back to the button that opened them.
$("textStops").innerHTML = STOPS.map((s, i) => `<h2>${i + 1}. ${s.title}</h2><p>${tagHtml(s.tags, " ")}</p>${s.body}<p><strong>Notice:</strong> ${s.notice}</p>`).join("");
const openers = new Map();
function openModal(id) {
  const d = $(id); openers.set(d, document.activeElement);
  closeMenu(false); d.showModal(); d.querySelector(".close, .btn")?.focus();
}
// "stay" means the code that closed the dialog has already placed focus
document.querySelectorAll("dialog").forEach((d) => d.addEventListener("close", () => { const o = openers.get(d); openers.delete(d); if (o === "stay") return; if (o && o.isConnected && o.offsetParent !== null) o.focus(); else $("guide").focus(); openers.delete(d); }));
$("textBtn").onclick = () => openModal("textModal");
$("aboutBtn").onclick = () => openModal("aboutModal");
$("stopsBtn").onclick = () => openModal("stopsModal");
document.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => $(b.dataset.close).close()));

// the list of all stops, a keyboard and screen reader path to every stop
function renderStopList() {
  $("stopList").innerHTML = STOPS.map((s, i) => { const seen = state.visited.has(s.id); return `<li><button class="btn${seen ? " seen" : ""}" data-stop="${i}"><span class="num" aria-hidden="true">${i + 1}</span>${i + 1}. ${s.title}<span class="state">${seen ? "Visited" : ""}</span></button></li>`; }).join("");
  $("stopList").querySelectorAll("[data-stop]").forEach((b) => (b.onclick = () => { openers.set($("stopsModal"), "stay"); $("stopsModal").close(); panelOpener = $("stopsBtn"); goToStop(Number(b.dataset.stop)); }));
}
renderStopList();

// visible quality control: cycles Low, Medium and High, then reloads with the same view
$("qualityBtn").textContent = `Quality: ${TIER.label}`;
$("qualityBtn").setAttribute("aria-label", `Graphics quality: ${TIER.label}. Press to change.`);
$("qualityBtn").onclick = nextQuality;
void QUALITY;

// Pause motion stops the people, sea, smoke and birds (WCAG 2.2.2). It starts paused when the
// device asks for reduced motion.
function setPaused(p) {
  state.paused = p;
  $("motionBtn").setAttribute("aria-pressed", String(p));
  $("motionBtn").textContent = p ? "Play motion" : "Pause motion";
}
$("motionBtn").onclick = () => setPaused(!state.paused);
setPaused(reduceMotion);

// on phones the tools fold into a Menu button
const tools = $("tools"), menuBtn = $("menuBtn");
function closeMenu(focusBack = true) { if (!tools.classList.contains("open")) return; tools.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); if (focusBack) menuBtn.focus(); }
menuBtn.onclick = () => { const open = !tools.classList.contains("open"); tools.classList.toggle("open", open); menuBtn.setAttribute("aria-expanded", String(open)); if (open) tools.querySelector(".btn").focus(); };
tools.addEventListener("click", (e) => { if (e.target.closest(".btn") && getComputedStyle(menuBtn).display !== "none") closeMenu(false); });

// the welcome dialog opens unless a link goes straight to a place in the scene
const intro = $("intro");
function closeIntro() { if (intro.open) { openers.set(intro, "stay"); intro.close(); } }
if (!/stop=|deck|cam=|overview/.test(location.hash)) intro.showModal();
$("start").onclick = () => { openers.set(intro, $("guide")); intro.close(); };
addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || document.querySelector("dialog[open]")) return;
  if (tools.classList.contains("open")) closeMenu();
  else if (!panel.hidden) closePanel();
});

// ---------------- resize ----------------
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();

export { goToStop, updateMarkers, updateBoardBtn, setSailLabel, closeIntro };
