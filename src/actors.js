import * as THREE from "three";
import { TAU, lerp, CUB, rngFrom } from "./util.js";
import { ell, PEN, Painter, makeCanvas, texFrom, C } from "./painter.js";
import { mapU, mapA, limb, figure, pose, walkPose, outfits, drawShield, drawChest } from "./figures.js";

// ---------- actor definitions: each returns a pose sheet painter ----------
const ACTORS = {
  // shipwright clenching a rivet: hammer up, strike
  wright: { w: 3.2, h: 4.3, N: 8, period: 0.9, draw: (P, U, i, N) => {
    const ph = i / N, up = ph < 0.6 ? Math.sin((ph / 0.6) * Math.PI / 2) : 1 - (ph - 0.6) / 0.4;
    const hand = [lerp(0.95, 0.75, up), lerp(-2.75, -3.75, up)];
    figure(P, U, pose(outfits.wright, { lean: 0.12,
      backArm: { el: [0.45, -2.45], hand: [0.95, -2.5] },
      frontArm: { el: [0.45, -2.75 - up * 0.35], hand },
      front: (U) => {
        const a = Math.atan2(-1, 0) + (1 - up) * 1.2 - 0.4;
        const head = [hand[0] + Math.cos(a) * 0.55, hand[1] + Math.sin(a) * 0.55];
        P.pencil(mapA(U, [hand, head]), { w: 3, color: "#6e4a2a" });
        P.shape(mapA(U, ell(head[0], head[1], 0.12, 0.07, 12, a)), C.iron, { alpha: 0.8, pen: { w: 1 } });
        if (up < 0.1) for (let j = 0; j < 3; j++) P.pencil(mapA(U, [[1.08, -2.6 + j * 0.05], [1.3, -2.75 + j * 0.12]]), { w: 1.2, color: "#c98a2a", passes: 1 });
      } }));
  } },
  // caulker kneeling, pushing tarred wool into a seam
  caulk: { w: 3.0, h: 3.4, N: 8, period: 1.4, draw: (P, U, i, N) => {
    const push = (1 - Math.cos((i / N) * TAU)) / 2;
    const tool = [lerp(0.95, 1.15, push), -1.75];
    figure(P, U, pose(outfits.caulk, { hip: [0, -1.05], sh: [0.35, -2.05],
      backLeg: { knee: [-0.45, -0.15], foot: [-1.0, -0.06] }, frontLeg: { knee: [0.5, -1.05], foot: [0.45, 0] },
      backArm: { el: [0.6, -1.6], hand: [tool[0] - 0.15, tool[1] + 0.05] },
      frontArm: { el: [0.65, -1.85], hand: [tool[0] - 0.25, tool[1] - 0.05] },
      behind: (U) => {
        P.shape(mapA(U, [[-1.4, 0], [-0.8, 0], [-0.85, -0.6], [-1.35, -0.6]]), C.tar, { alpha: 0.75 });
        P.shape(mapA(U, ell(-1.1, -0.6, 0.27, 0.07, 16)), "#1d1712", { alpha: 0.8, pen: { w: 1 } });
        for (let j = 0; j < 3; j++) P.wash(mapA(U, ell(-1.05 + j * 0.06, -0.95 - j * 0.35 - push * 0.1, 0.15 + j * 0.05, 0.12, 14)), "#cfd2d1", { alpha: 0.25, grain: false, edge: 0.2 });
      },
      front: (U) => { P.pencil(mapA(U, [[tool[0] - 0.3, tool[1]], tool]), { w: 3.5, color: "#5c4a3a" }); P.shape(mapA(U, ell(tool[0] + 0.05, tool[1], 0.07, 0.05, 10)), "#4a4038", { alpha: 0.7, pen: { w: 0.8 } }); },
    }));
  } },
  // two crew carrying an oar on their shoulders
  oars: { w: 9.0, h: 4.3, N: 12, period: 1.1, draw: (P, U0, i, N) => {
    const ph = i / N;
    const Ua = (x, y) => U0(x + 2.3, y), Ub = (x, y) => U0(x + 6.6, y);
    const oarY = -3.05 + Math.sin(ph * 2 * TAU) * 0.03;
    P.pencil(mapA(U0, [[0.3, oarY + 0.05], [8.6, oarY - 0.05]]), { w: 5, color: "#9c7146" });
    P.shape(mapA(U0, [[0.2, oarY - 0.12], [1.5, oarY - 0.06], [1.5, oarY + 0.12], [0.2, oarY + 0.18]]), "#b28552", { alpha: 0.65, pen: { w: 1 } });
    figure(P, Ua, walkPose(outfits.oar2, (ph + 0.25) % 1, 1.4, { frontArm: { el: [0.35, -2.6], hand: [0.25, -3.12] }, backArm: { el: [-0.25, -2.6], hand: [-0.15, -3.1] } }));
    figure(P, Ub, walkPose(outfits.oar1, ph, 1.4, { frontArm: { el: [0.3, -2.6], hand: [0.2, -3.1] }, backArm: { el: [-0.3, -2.6], hand: [-0.2, -3.08] } }));
  } },
  // crewman on deck lifting a shield onto the rail
  shield: { w: 3.0, h: 4.6, N: 10, period: 2.4, draw: (P, U, i, N) => {
    const up = (1 - Math.cos((i / N) * TAU)) / 2;
    const hand = [lerp(0.55, 0.9, up), lerp(-2.0, -3.0, up)];
    figure(P, U, pose(outfits.shield, { lean: 0.05 + up * 0.08,
      backArm: { el: [0.25, -2.45 - up * 0.3], hand: [hand[0] - 0.1, hand[1] + 0.25] },
      frontArm: { el: [0.4, -2.35 - up * 0.3], hand: [hand[0] + 0.05, hand[1] - 0.15] },
      behind: (U) => drawShield(P, U, hand[0] + 0.35, hand[1], 0.95, i % 2 ? C.shieldY : C.shieldY) }));
  } },
  // steersman with a hand on the tiller
  steer: { w: 3.2, h: 4.3, N: 8, period: 4, draw: (P, U, i, N) => {
    const sway = Math.sin((i / N) * TAU);
    figure(P, U, pose(outfits.steer, { lean: 0.05 * sway, headX: 0.03 * sway,
      frontArm: { el: [0.45, -2.3], hand: [0.85, -2.0 + sway * 0.04] },
      backArm: { el: [0.3, -2.9], hand: [0.25, -3.45] },
      front: (U) => P.pencil(mapA(U, [[0.6, -2.0 + sway * 0.04], [1.6, -2.05 + sway * 0.06]]), { w: 4, color: "#7a5532" }) }));
  } },
  // crewman hauling on a rope at the mast
  rope: { w: 2.8, h: 4.6, N: 10, period: 1.6, draw: (P, U, i, N) => {
    const ph = i / N, a = Math.sin(ph * TAU), b = Math.sin(ph * TAU + Math.PI);
    const h1 = [0.45, -3.2 + a * 0.45], h2 = [0.45, -3.2 + b * 0.45];
    figure(P, U, pose(outfits.rope, { lean: -0.12, backArm: { el: [0.3, -2.8], hand: h1 }, frontArm: { el: [0.32, -2.75], hand: h2 },
      behind: (U) => P.pencil(mapA(U, [[0.5, -4.6], [0.45, -2.0], [0.2, -0.3], [-0.6, -0.1]]), { w: 2, color: "#8b6b43" }) }));
  } },
  // one crewman on the beach heaves a sea chest up to another leaning over the rail
  chest: { w: 4.6, h: 6.4, N: 10, period: 2.6, draw: (P, U0, i, N) => {
    const up = (1 - Math.cos((i / N) * TAU)) / 2;
    const cy = lerp(-2.6, -3.7, up);
    const Ua = (x, y) => U0(x + 1.3, y);
    // crewman on deck, seen above the rail
    const Ub = (x, y) => U0(x + 3.2, y - 3.5);
    figure(P, Ub, pose({ ...outfits.chest2, dress: false }, { hip: [0, -1.85], sh: [-0.35, -2.85],
      backArm: { el: [-0.75, -2.3], hand: [-1.15, -1.9 + (1 - up) * 0.3] }, frontArm: { el: [-0.7, -2.25], hand: [-1.05, -1.85 + (1 - up) * 0.3] } }));
    figure(P, Ua, pose(outfits.chest1, { lean: 0.1,
      backArm: { el: [0.35, cy + 0.5], hand: [0.75, cy + 0.15] }, frontArm: { el: [0.4, cy + 0.45], hand: [0.85, cy + 0.1] },
      front: (U) => drawChest(P, U, 0.55, cy + 0.2, 1.1, 0.75) }));
  } },
  // two players at a gaming board on a chest
  game: { w: 4.2, h: 3.4, N: 12, period: 3.2, draw: (P, U0, i, N) => {
    const ph = i / N, reach = ph < 0.4 ? Math.sin((ph / 0.4) * Math.PI) : 0, think = Math.sin(ph * TAU) * 0.03;
    const Ua = (x, y) => U0(x + 0.9, y), Ub = (x, y) => U0(-(x) + 3.3, y);
    const seat = (o, arm, flip) => pose(o, { hip: [0, -1.05], sh: [0.15, -2.15], headY: think,
      backLeg: { knee: [0.55, -1.1], foot: [0.6, 0] }, frontLeg: { knee: [0.6, -1.05], foot: [0.7, 0] },
      backArm: { el: [0.4, -1.65], hand: [0.6, -1.45] }, frontArm: arm,
      behind: (U) => P.shape(mapA(U, [[-0.35, 0], [0.25, 0], [0.25, -1.0], [-0.35, -1.0]]), "#8a6a48", { alpha: 0.6 }) });
    // board between them
    P.shape(mapA(U0, [[1.75, 0], [2.45, 0], [2.45, -1.0], [1.75, -1.0]]), C.oak, { alpha: 0.6 });
    P.shape(mapA(U0, [[1.55, -1.0], [2.65, -1.0], [2.6, -1.12], [1.6, -1.12]]), "#c9a272", { alpha: 0.7 });
    for (let j = 0; j < 7; j++) P.dot(...U0(1.65 + j * 0.15, -1.15), 3.2 * P.s, j === 3 ? "#f1e9d9" : j % 2 ? "#2d2a28" : "#e8dcc6");
    figure(P, Ua, seat(outfits.game1, { el: [0.6, -1.85 - reach * 0.1], hand: [0.75 + reach * 0.35, -1.5 - reach * 0.1] }));
    figure(P, Ub, seat(outfits.game2, { el: [0.45, -1.8], hand: [0.55, -2.3 + think] }));
  } },
  // cook stirring a pot over the fire
  cook: { w: 3.6, h: 4.2, N: 10, period: 2.2, draw: (P, U, i, N) => {
    const a = (i / N) * TAU, sx = 1.45 + Math.cos(a) * 0.15;
    const R = rngFrom(400 + i);
    // tripod, pot, fire
    for (const [x0, x1] of [[0.9, 1.5], [2.1, 1.5]]) P.pencil(mapA(U, [[x0, 0], [x1, -2.2]]), { w: 3, color: "#5b4127" });
    P.pencil(mapA(U, [[1.5, -2.2], [1.5, -1.45]]), { w: 1.5, color: C.iron });
    for (let f = 0; f < 5; f++) { const cx = 1.2 + f * 0.13 + (R() - 0.5) * 0.05, hh = 0.35 + R() * 0.35; P.shape(mapA(U, [[cx - 0.1, -0.05], [cx + (R() - 0.5) * 0.1, -hh], [cx + 0.1, -0.05]]), f % 2 ? "#f0a83a" : "#e2672c", { alpha: 0.6, grain: false, pen: { w: 0.8, color: "#7a3a20", alpha: 0.4 } }); }
    P.shape(mapA(U, [[1.1, -0.9], [1.9, -0.9], [1.85, -1.25], [1.75, -1.45], [1.25, -1.45], [1.15, -1.25]]), "#4f4a46", { alpha: 0.75 });
    figure(P, U, pose(outfits.cook, { lean: 0.15, hip: [0.1, -1.85],
      backArm: { el: [0.55, -2.4], hand: [0.85, -2.15] }, frontArm: { el: [0.6, -2.35], hand: [sx - 0.25, -2.25] },
      front: (U) => P.pencil(mapA(U, [[sx - 0.3, -2.3], [sx, -1.35]]), { w: 3, color: "#7a5532" }) }));
  } },
  // groom holding a grazing horse
  horse: { w: 7.0, h: 5.2, N: 12, period: 5, draw: (P, U, i, N) => {
    const g = (1 - Math.cos((i / N) * TAU)) / 2; // head down to graze
    const tail = Math.sin((i / N) * TAU * 2) * 0.15;
    const bx = 3.6;
    const legs = [[-1.0, 0.04], [-0.75, -0.02], [0.75, 0.03], [1.0, -0.03]];
    legs.forEach(([lx, sk], j) => limb(P, U, [[bx + lx, -2.4], [bx + lx + sk, -1.2], [bx + lx + sk * 2, -0.1]], [0.17, 0.11, 0.09], j % 2 ? "#6e4a30" : "#8a5d3b"));
    P.shape(mapA(U, ell(bx, -2.65, 1.35, 0.62, 30)), "#8a5d3b", { alpha: 0.6 });
    P.wash(mapA(U, ell(bx + 0.1, -2.35, 1.1, 0.3, 24)), "#6e4a30", { alpha: 0.3, grain: false, edge: 0.1 });
    P.shape(mapA(U, [[bx - 1.25, -2.9], [bx - 1.55 + tail, -2.2], [bx - 1.5 + tail * 1.5, -1.5], [bx - 1.35, -2.4]]), "#3e2a1e", { alpha: 0.7, pen: { w: 1 } });
    const neckTop = [bx + 1.1, -3.0], head = [lerp(bx + 2.0, bx + 2.0, g), lerp(-3.9, -0.7, g)];
    P.shape(mapA(U, [[bx + 0.9, -3.1], neckTop, [head[0] - 0.05, head[1] - 0.2], [head[0] + 0.2, head[1] + 0.1], [bx + 1.3, -2.3]]), "#8a5d3b", { alpha: 0.6 });
    P.shape(mapA(U, ell(head[0] + 0.25, head[1] + (g > 0.5 ? 0.1 : 0.15), 0.42, 0.2, 18, g > 0.5 ? 1.2 : 0.6)), "#8a5d3b", { alpha: 0.6 });
    P.pencil(mapA(U, [[bx + 0.9, -3.15], [lerp(bx + 1.6, bx + 1.6, g), lerp(-3.7, -1.9, g)]]), { w: 4, color: "#3e2a1e" });
    if (g < 0.4) for (let j = 0; j < 4; j++) P.pencil(mapA(U, [[head[0] + 0.2 + j * 0.06, -0.02], [head[0] + 0.15 + j * 0.08, -0.25]]), { w: 1, color: "#6f7a3a", passes: 1 });
    const hand = [1.3, -1.9 + g * 0.2];
    P.pencil(mapA(U, [hand, [(hand[0] + head[0]) / 2, Math.max(hand[1], head[1]) + 0.3], [head[0] + 0.1, head[1] + 0.15]]), { w: 1.6, color: "#6b4a2c" });
    figure(P, U, pose(outfits.groom, { hip: [0.6, -1.85], frontArm: { el: [1.0, -2.3], hand }, backArm: { el: [0.5, -2.4], hand: [0.6, -1.85] } }));
  } },
  // dog trotting
  dog: { w: 2.2, h: 1.6, N: 8, period: 0.55, draw: (P, U, i, N) => {
    const ph = i / N;
    [[0.6, 0], [0.75, 0.5], [1.45, 0.25], [1.6, 0.75]].forEach(([x, off], j) => { const q = Math.sin((ph + off) * TAU); limb(P, U, [[x, -0.8], [x + q * 0.1, -0.4], [x + q * 0.18, -0.05 - Math.max(0, q) * 0.1]], [0.08, 0.06, 0.05], j % 2 ? "#7a5c3c" : "#9b7a52"); });
    P.shape(mapA(U, ell(1.1, -0.85, 0.6, 0.22, 20)), "#9b7a52", { alpha: 0.6 });
    P.shape(mapA(U, ell(1.8, -1.1, 0.22, 0.16, 16)), "#9b7a52", { alpha: 0.6 });
    P.shape(mapA(U, [[1.75, -1.25], [1.85, -1.45], [1.9, -1.22]]), "#7a5c3c", { alpha: 0.7, pen: { w: 1 } });
    P.pencil(mapA(U, [[0.52, -0.9], [0.3, -1.15 + Math.sin(ph * TAU * 2) * 0.1]]), { w: 3, color: "#7a5c3c" });
    P.dot(...U(1.92, -1.13), 1.6 * P.s, PEN);
  } },
};

class Actor {
  constructor(key, seed, opts = {}) {
    const def = ACTORS[key]; this.def = def; this.N = def.N; this.period = def.period;
    const k = opts.k || 110;
    const W = Math.round(def.w * k), H = Math.round(def.h * k);
    const cols = Math.max(1, Math.min(def.N, Math.floor(8192 / W))), rows = Math.ceil(def.N / cols);
    this.cols = cols; this.rows = rows;
    const cv = makeCanvas(W * cols, H * rows), ctx = cv.getContext("2d");
    for (let i = 0; i < def.N; i++) {
      const ox = (i % cols) * W, oy = Math.floor(i / cols) * H;
      ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, W, H); ctx.clip();
      const P = new Painter(ctx, seed * 97 + (i % 3) * 13, k / 200); P.solid = true;
      def.draw(P, mapU(ox + 0.4 * k, oy + H - 0.12 * k, k), i, def.N);
      ctx.restore();
    }
    this.tex = texFrom(cv); this.tex.repeat.set(1 / cols, 1 / rows);
    const g = new THREE.PlaneGeometry(def.w * CUB, def.h * CUB); g.translate(def.w * CUB / 2 - 0.4 * CUB, def.h * CUB / 2 - 0.12 * CUB, 0);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, alphaTest: 0.08, side: THREE.DoubleSide, toneMapped: false }));
    this.phase = opts.phase || 0; this.face = opts.face || null; this.mesh.renderOrder = 2;
    this.flipBase = opts.flip ? -1 : 1;
  }
  update(t, cam) {
    const i = Math.floor((((t / this.period + this.phase) % 1) + 1) % 1 * this.N);
    this.tex.offset.set((i % this.cols) / this.cols, (this.rows - 1 - Math.floor(i / this.cols)) / this.rows);
    const p = this.mesh.position;
    this.mesh.rotation.y = Math.atan2(cam.position.x - p.x, cam.position.z - p.z);
    let s = this.flipBase;
    if (this.face) {
      const right = new THREE.Vector3(Math.cos(this.mesh.rotation.y), 0, -Math.sin(this.mesh.rotation.y));
      s = Math.sign(right.dot(new THREE.Vector3().subVectors(this.face, p))) || 1;
    }
    this.mesh.scale.x = s;
  }
}

export { ACTORS, Actor };
