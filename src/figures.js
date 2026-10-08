import { TAU, lerp } from "./util.js";
import { ell, strokePoly, PEN, C } from "./painter.js";

// ---------------- Norse figures (side view, facing right; cubits, feet at origin, up is negative) ----------------
function mapU(gx, gy, k) { return (x, y) => [gx + x * k, gy + y * k]; }
const mapA = (U, a) => a.map(([x, y]) => U(x, y));
function limb(P, U, pts, ws, col, o = {}) { P.shape(mapA(U, strokePoly(pts, ws)), col, { alpha: 0.5, pen: { w: 1.2 }, ...o }); }

function figure(P, U, f) {
  const o = f.o, H = f.hip, S = f.sh;
  const skin = o.skin || C.skin;
  const drawLeg = (leg, shade) => {
    if (o.dress) return;
    limb(P, U, [H, leg.knee, leg.foot.map((v, i) => v + (i ? -0.12 : 0))], [0.17, 0.14, 0.11], shade ? o.legS || "#6b5a48" : o.leg || "#8a7660");
    if (o.wraps) for (let j = 0; j < 4; j++) { const f2 = 0.25 + j * 0.17; const a = [lerp(leg.knee[0], leg.foot[0], f2), lerp(leg.knee[1], leg.foot[1] - 0.12, f2)]; P.pencil(mapA(U, [[a[0] - 0.12, a[1] + 0.06], [a[0] + 0.12, a[1] - 0.04]]), { w: 1, alpha: 0.6, passes: 1 }); }
    P.shape(mapA(U, ell(leg.foot[0] + 0.1, leg.foot[1] - 0.06, 0.2, 0.08, 16, leg.toe || 0)), "#5a4030", { alpha: 0.7, pen: { w: 1 } });
  };
  const drawArm = (a, shade) => {
    limb(P, U, [S.map((v, i) => v + (i ? 0.05 : 0)), a.el, a.hand], [0.13, 0.12, 0.1], shade ? o.tunicS : o.tunic);
    P.shape(mapA(U, ell(a.hand[0], a.hand[1], 0.085, 0.095, 14)), shade ? C.skinS : skin, { alpha: 0.6, pen: { w: 1 } });
  };
  if (f.behind) f.behind(U);
  drawArm(f.backArm, true);
  drawLeg(f.backLeg, true);
  drawLeg(f.frontLeg, false);
  if (o.dress) {
    const hem = 0.02;
    P.shape(mapA(U, [[S[0] - 0.2, S[1] - 0.02], [S[0] + 0.2, S[1]], [H[0] + 0.3, H[1]], [H[0] + 0.42 + (f.kick || 0), -hem - 0.1], [H[0] - 0.4, -hem - 0.1], [H[0] - 0.3, H[1]]]), o.tunic, { alpha: 0.5 });
    for (const lf of [f.backLeg, f.frontLeg]) P.shape(mapA(U, ell(lf.foot[0] + 0.1, lf.foot[1] - 0.05, 0.18, 0.07, 14)), "#5a4030", { alpha: 0.7, pen: { w: 1 } });
    P.shape(mapA(U, [[S[0] - 0.12, S[1] + 0.25], [S[0] + 0.18, S[1] + 0.25], [H[0] + 0.32, -0.25], [H[0] - 0.28, -0.25]]), o.apron, { alpha: 0.55 });
    P.shape(mapA(U, ell(S[0] + 0.12, S[1] + 0.32, 0.07, 0.1, 12)), "#c9a13e", { alpha: 0.8, pen: { w: 1 } });
    for (let j = 0; j < 5; j++) P.dot(...U(S[0] + 0.06 + j * 0.02, S[1] + 0.42 + Math.sin(j) * 0.03), 2 * P.s, ["#c94a3a", "#3e7fa3", "#e2c35a"][j % 3]);
  } else {
    const kick = f.kick || 0;
    const tunic = [[S[0] - 0.24, S[1] - 0.04], [S[0] + 0.22, S[1]], [H[0] + 0.28, H[1] - 0.05], [H[0] + 0.38 + kick, H[1] + 0.45], [H[0] - 0.36, H[1] + 0.48], [H[0] - 0.29, H[1] - 0.05]];
    P.shape(mapA(U, tunic), o.tunic, { alpha: 0.5 });
    P.wash(mapA(U, [[S[0] - 0.24, S[1] - 0.04], [S[0] - 0.02, S[1]], [H[0] - 0.02, H[1] + 0.47], [H[0] - 0.36, H[1] + 0.48], [H[0] - 0.29, H[1] - 0.05]]), o.tunicS, { alpha: 0.3, grain: false, edge: 0.1 });
    P.pencil(mapA(U, [[H[0] - 0.3, H[1] - 0.08], [H[0] + 0.3, H[1] - 0.1]]), { w: 3, color: "#4a3426" });
    P.pencil(mapA(U, [[H[0] + 0.05, H[1] + 0.05], [H[0] + 0.1 + kick * 0.5, H[1] + 0.42]]), { w: 1, alpha: 0.4 });
  }
  if (o.cloak) P.shape(mapA(U, [[S[0] - 0.05, S[1] - 0.1], [S[0] - 0.3, S[1] + 0.05], [H[0] - 0.45, H[1] + 0.2], [H[0] - 0.2, H[1] + 0.25], [S[0] + 0.05, S[1] + 0.2]]), o.cloak, { alpha: 0.55 });
  // head
  const hc = [S[0] + 0.08 + (f.headX || 0), S[1] - 0.42 + (f.headY || 0)];
  P.shape(mapA(U, [[S[0] - 0.03, S[1] - 0.05], [S[0] + 0.12, S[1] - 0.05], [hc[0] + 0.05, hc[1] + 0.2], [hc[0] - 0.08, hc[1] + 0.2]]), skin, { alpha: 0.6, line: false });
  P.shape(mapA(U, ell(hc[0], hc[1], 0.2, 0.24, 22)), skin, { alpha: 0.6 });
  P.shape(mapA(U, [[hc[0] + 0.18, hc[1] - 0.04], [hc[0] + 0.26, hc[1] + 0.05], [hc[0] + 0.17, hc[1] + 0.08]]), skin, { alpha: 0.6, pen: { w: 1 } });
  P.dot(...U(hc[0] + 0.1, hc[1] - 0.04), 1.8 * P.s, PEN);
  const hair = o.hair || C.hairB;
  if (o.scarf) P.shape(mapA(U, [[hc[0] + 0.16, hc[1] - 0.16], [hc[0] + 0.02, hc[1] - 0.28], [hc[0] - 0.18, hc[1] - 0.24], [hc[0] - 0.26, hc[1] + 0.05], [hc[0] - 0.2, hc[1] + 0.4], [hc[0] - 0.05, hc[1] + 0.3], [hc[0] - 0.06, hc[1] + 0.05], [hc[0] + 0.05, hc[1] - 0.14]]), o.scarf, { alpha: 0.55 });
  else P.shape(mapA(U, [[hc[0] + 0.16, hc[1] - 0.15], [hc[0] + 0.02, hc[1] - 0.27], [hc[0] - 0.18, hc[1] - 0.2], [hc[0] - 0.23, hc[1] + 0.12], [hc[0] - 0.08, hc[1] + 0.06], [hc[0] - 0.04, hc[1] - 0.1], [hc[0] + 0.08, hc[1] - 0.12]]), hair, { alpha: 0.6, pen: { w: 1 } });
  if (o.beard) P.shape(mapA(U, [[hc[0] - 0.02, hc[1] + 0.08], [hc[0] + 0.2, hc[1] + 0.1], [hc[0] + 0.15, hc[1] + 0.3], [hc[0] + 0.02, hc[1] + 0.34], [hc[0] - 0.08, hc[1] + 0.2]]), hair, { alpha: 0.65, pen: { w: 1 } });
  if (o.cap) P.shape(mapA(U, [[hc[0] - 0.2, hc[1] - 0.1], [hc[0] - 0.12, hc[1] - 0.3], [hc[0] + 0.08, hc[1] - 0.32], [hc[0] + 0.2, hc[1] - 0.12]]), o.cap, { alpha: 0.6, pen: { w: 1 } });
  drawLeg && drawArm(f.frontArm, false);
  if (f.front) f.front(U);
}

// standing / walking pose helper
function pose(o, p = {}) {
  const hip = p.hip || [0, -1.85], sh = p.sh || [hip[0] + (p.lean || 0), hip[1] - 1.15];
  return {
    o, hip, sh, kick: p.kick || 0, headX: p.headX || 0, headY: p.headY || 0,
    backLeg: p.backLeg || { knee: [hip[0] - 0.06, -0.95], foot: [hip[0] - 0.1, 0] },
    frontLeg: p.frontLeg || { knee: [hip[0] + 0.08, -0.95], foot: [hip[0] + 0.1, 0] },
    backArm: p.backArm || { el: [sh[0] - 0.1, sh[1] + 0.6], hand: [sh[0] - 0.05, sh[1] + 1.15] },
    frontArm: p.frontArm || { el: [sh[0] + 0.08, sh[1] + 0.6], hand: [sh[0] + 0.12, sh[1] + 1.15] },
    behind: p.behind, front: p.front,
  };
}
function walkPose(o, ph, S, extra = {}) {
  const leg = (q) => { q = ((q % 1) + 1) % 1; if (q < 0.5) { const x = S / 2 - (q / 0.5) * S; return { knee: [x * 0.55 + 0.05, -0.95], foot: [x, 0] }; } const r = (q - 0.5) / 0.5, x = -S / 2 + r * S, lift = Math.sin(r * Math.PI) * 0.3; return { knee: [x * 0.6 + 0.15, -0.95 - lift * 0.4], foot: [x, -lift], toe: -0.3 * lift }; };
  const bob = -0.06 * (1 - Math.cos(ph * 2 * TAU)) / 2;
  return pose(o, { hip: [0, -1.85 + bob], kick: Math.sin(ph * TAU) * 0.08, frontLeg: leg(ph), backLeg: leg(ph + 0.5), ...extra });
}

const outfits = {
  wright: { tunic: C.wool3, tunicS: "#5d6a3c", leg: "#7d6a55", wraps: true, beard: true, hair: C.hairB, cap: "#8a6d4a" },
  caulk: { tunic: C.wool4, tunicS: "#a08c64", leg: "#6f6556", wraps: true, beard: true, hair: C.hairD },
  oar1: { tunic: C.wool1, tunicS: "#4f6683", leg: "#7d6a55", wraps: true, beard: true, hair: C.hairF },
  oar2: { tunic: C.wool2, tunicS: "#7a3f28", leg: "#6f6556", wraps: true, hair: C.hairB },
  shield: { tunic: C.wool5, tunicS: "#683a52", leg: "#7d6a55", wraps: true, beard: true, hair: C.hairF },
  steer: { tunic: C.wool2, tunicS: "#7a3f28", leg: "#5d5347", wraps: true, beard: true, hair: "#8f8f8a", cloak: "#4c5d77" },
  rope: { tunic: C.wool1, tunicS: "#4f6683", leg: "#6f6556", wraps: true, hair: C.hairD, beard: true },
  chest1: { tunic: C.wool4, tunicS: "#a08c64", leg: "#7d6a55", wraps: true, beard: true, hair: C.hairB },
  chest2: { tunic: C.wool3, tunicS: "#5d6a3c", leg: "#6f6556", wraps: true, hair: C.hairF, beard: true },
  game1: { tunic: C.wool2, tunicS: "#7a3f28", leg: "#6f6556", wraps: true, beard: true, hair: C.hairF },
  game2: { tunic: C.wool1, tunicS: "#4f6683", leg: "#7d6a55", wraps: true, hair: C.hairD },
  cook: { dress: true, tunic: "#7a8fa8", tunicS: "#5c7088", apron: "#b9573a", scarf: "#e6dbc0" },
  groom: { tunic: C.wool4, tunicS: "#a08c64", leg: "#6f6556", wraps: true, hair: C.hairF },
};

// ---------- props drawn on cards ----------
function drawShield(P, U, cx, cy, r, col) {
  P.shape(mapA(U, ell(cx, cy, r, r, 30)), col, { alpha: 0.65 });
  P.shape(mapA(U, ell(cx, cy, r * 0.25, r * 0.25, 16)), "#8d8c88", { alpha: 0.7, pen: { w: 1 } });
}
function drawChest(P, U, x, y, w, h) {
  P.shape(mapA(U, [[x, y], [x + w, y], [x + w, y - h], [x, y - h]]), C.oak, { alpha: 0.6 });
  P.pencil(mapA(U, [[x, y - h * 0.75], [x + w, y - h * 0.75]]), { w: 1.2 });
  P.shape(mapA(U, [[x + w * 0.45, y - h * 0.8], [x + w * 0.55, y - h * 0.8], [x + w * 0.55, y - h * 0.55], [x + w * 0.45, y - h * 0.55]]), C.iron, { alpha: 0.7, pen: { w: 1 } });
}

export { mapU, mapA, limb, figure, pose, walkPose, outfits, drawShield, drawChest };
