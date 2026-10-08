import * as THREE from "three";
import { TAU, lerp, rngFrom } from "./util.js";

// ---------------- pencil + watercolour painter ----------------
function bbox(pts) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; }
function ell(cx, cy, rx, ry, n = 28, rot = 0, bump = 0, bumpN = 0) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU, f = 1 + bump * Math.sin(a * bumpN); const x = Math.cos(a) * rx * f, y = Math.sin(a) * ry * f; out.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]); }
  return out;
}
function strokePoly(pts, hws) {
  const L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, h = hws[i];
    L.push([pts[i][0] + nx * h, pts[i][1] + ny * h]); R.push([pts[i][0] - nx * h, pts[i][1] - ny * h]);
  }
  return L.concat(R.reverse());
}
const PAPER = "#f4ead5", PEN = "#3d3027";
class Painter {
  constructor(ctx, seed, s = 1) { this.c = ctx; this.r = rngFrom(seed); this.s = s; this.solid = false; }
  rr(a, b) { return a + (b - a) * this.r(); }
  dens(pts, closed, step) {
    const out = [], n = pts.length, m = closed ? n : n - 1;
    for (let i = 0; i < m; i++) { const a = pts[i], b = pts[(i + 1) % n]; const st = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let j = 0; j < st; j++) out.push([lerp(a[0], b[0], j / st), lerp(a[1], b[1], j / st)]); }
    if (!closed) out.push(pts[n - 1].slice());
    return out;
  }
  jit(pts, amp) { let ox = 0, oy = 0; return pts.map((p) => { ox = ox * 0.65 + (this.r() - 0.5) * amp; oy = oy * 0.65 + (this.r() - 0.5) * amp; return [p[0] + ox, p[1] + oy]; }); }
  path(pts, closed) { const c = this.c; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); if (closed) c.closePath(); }
  wash(pts, color, o = {}) {
    const c = this.c, s = this.s, layers = o.layers ?? 3, alpha = o.alpha ?? 0.42, jit = (o.jit ?? 2.4) * s;
    const d = this.dens(pts, true, 7 * s);
    c.save(); c.fillStyle = color;
    for (let i = 0; i < layers; i++) { c.globalAlpha = alpha; this.path(this.jit(d, jit), true); c.fill(); }
    const edge = o.edge ?? 0.5;
    if (edge > 0) { c.globalAlpha = edge * 0.5; c.strokeStyle = o.edgeColor || color; c.lineWidth = 2 * s; this.path(this.jit(d, jit * 0.5), true); c.stroke(); }
    if (o.grain !== false) {
      this.path(d, true); c.clip(); const bb = bbox(d); const n = Math.min(1500, (bb.w * bb.h) / (140 * s * s));
      c.fillStyle = "#3b2a1a";
      for (let i = 0; i < n; i++) { c.globalAlpha = this.rr(0.03, 0.09); c.fillRect(this.rr(bb.x, bb.x + bb.w), this.rr(bb.y, bb.y + bb.h), this.rr(0.7, 2) * s, this.rr(0.7, 2) * s); }
    }
    c.restore();
  }
  pencil(pts, o = {}) {
    const c = this.c, s = this.s, d = this.dens(pts, o.closed ?? false, 5 * s);
    c.save(); c.strokeStyle = o.color || PEN; c.lineCap = "round"; c.lineJoin = "round";
    const passes = o.passes ?? 2;
    for (let p = 0; p < passes; p++) { c.globalAlpha = (o.alpha ?? 0.8) * (p ? 0.5 : 1); c.lineWidth = (o.w ?? 1.5) * s * (p ? 0.7 : 1); this.path(this.jit(d, (o.jit ?? 1.1) * s), o.closed ?? false); c.stroke(); }
    c.restore();
  }
  shape(pts, color, o = {}) {
    if (this.solid && o.solid !== false) { const c = this.c; c.save(); c.globalAlpha = 1; c.fillStyle = PAPER; this.path(this.dens(pts, true, 7 * this.s), true); c.fill(); c.restore(); }
    this.wash(pts, color, o);
    if (o.line !== false) this.pencil(pts, { closed: true, ...(o.pen || {}) });
  }
  dot(x, y, r, color, a = 1) { const c = this.c; c.save(); c.globalAlpha = a; c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.restore(); }
}
function makeCanvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
function texFrom(cv, repeat) { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); } return t; }
function paintTex(w, h, seed, draw, repeat) { const cv = makeCanvas(w, h); const ctx = cv.getContext("2d"); draw(new Painter(ctx, seed, w / 600), ctx, w, h); return texFrom(cv, repeat); }

// ---------------- palette ----------------
const C = {
  oak: "#a77a4c", oakD: "#7a5532", oakL: "#c9a272", tar: "#3b2f28", iron: "#4b4846",
  skin: "#d9a27a", skinS: "#b07c58", hairB: "#8a5a32", hairF: "#c99a52", hairD: "#4a3426",
  wool1: "#6f87a6", wool2: "#9b5a3c", wool3: "#7f8a55", wool4: "#c9b48a", wool5: "#8a4f6e", linen: "#efe6d1",
  shieldY: "#e0b23a", shieldK: "#2d2a28", sailW: "#f1ead9", sailR: "#b5382c",
};

export { bbox, ell, strokePoly, PAPER, PEN, Painter, makeCanvas, texFrom, paintTex, C };
