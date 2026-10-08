import * as THREE from "three";
import { TAU, lerp, CUB, rngFrom } from "./util.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { pbr } from "./textures.js";

// People and animals as jointed 3D figures. Poses come from the proof of concept's side-view
// pose functions, in cubits with x forward and y up negative. Each figure maps them to its own
// local frame, where +z is forward, +y is up and +x is the figure's right side.

// ---------------- palette and outfits ----------------
// Colours follow docs/people-research.md: mostly undyed wool in natural browns and greys,
// woad blue and greens, with madder red kept for the most senior man.
const C = {
  skin: "#c4927a", shieldY: 0xd7a531, oak: 0xa77a4c, iron: 0x4b4846, bronze: "#a8833f",
  hairBrown: "#5a3d28", hairDark: "#33251b", hairFair: "#b08a52", hairRed: "#8a4a2a", hairGrey: "#8f8b84",
  undyedBrown: "#7b6450", undyedGrey: "#8a857a", undyedLight: "#b6aa92", woad: "#4f6886", woadDark: "#3c4f68", green: "#5f6d45", madder: "#8e3a2a", linen: "#cfc4ad",
};
// hair: "fringe" (short nape, long fringe), "collar" (to the collar), "short", "knot" (tied at the nape)
// beard: "full", "moustache" or none
const outfits = {
  wright: { tunic: C.undyedBrown, leg: C.undyedGrey, wrap: "#5a4a3a", hair: C.hairBrown, hairStyle: "fringe", beard: "full", cap: "#5c4c3e" },
  caulk: { tunic: C.undyedLight, leg: "#6b5a48", wrap: "#4e4237", hair: C.hairDark, hairStyle: "collar", beard: "moustache" },
  oar1: { tunic: C.woad, leg: C.undyedGrey, wrap: "#5a4a3a", hair: C.hairFair, hairStyle: "fringe", beard: "full" },
  oar2: { tunic: C.undyedBrown, leg: "#6b5a48", wrap: "#4e4237", hair: C.hairRed, hairStyle: "collar" },
  shield: { tunic: C.green, leg: C.undyedGrey, wrap: "#4e4237", hair: C.hairFair, hairStyle: "fringe", beard: "full" },
  steer: { tunic: C.madder, trim: "#d4b25a", leg: "#4a4038", wrap: "#2f2822", hair: C.hairGrey, hairStyle: "short", beard: "full", cloak: C.woadDark },
  rope: { tunic: C.undyedGrey, leg: "#6b5a48", wrap: "#4e4237", hair: C.hairDark, hairStyle: "collar", beard: "moustache" },
  chest1: { tunic: C.undyedBrown, leg: C.undyedGrey, wrap: "#5a4a3a", hair: C.hairBrown, hairStyle: "fringe", beard: "full" },
  chest2: { tunic: C.green, leg: "#6b5a48", wrap: "#4e4237", hair: C.hairFair, hairStyle: "collar", beard: "moustache" },
  game1: { tunic: "#7d4a36", leg: "#6b5a48", wrap: "#4e4237", hair: C.hairRed, hairStyle: "fringe", beard: "full" },
  game2: { tunic: C.woad, leg: C.undyedGrey, wrap: "#5a4a3a", hair: C.hairDark, hairStyle: "collar" },
  cook: { dress: true, under: C.linen, tunic: C.woad, shawl: "#7a5f48", hair: C.hairFair, hairStyle: "knot" },
  groom: { tunic: C.undyedLight, leg: C.undyedGrey, wrap: "#5a4a3a", hair: C.hairBrown, hairStyle: "fringe" },
};

// standing pose with optional overrides (from the proof of concept)
function pose(o, p = {}) {
  const hip = p.hip || [0, -1.85], sh = p.sh || [hip[0] + (p.lean || 0), hip[1] - 1.15];
  return {
    o, hip, sh, kick: p.kick || 0, headX: p.headX || 0, headY: p.headY || 0,
    backLeg: p.backLeg || { knee: [hip[0] - 0.06, -0.95], foot: [hip[0] - 0.1, 0] },
    frontLeg: p.frontLeg || { knee: [hip[0] + 0.08, -0.95], foot: [hip[0] + 0.1, 0] },
    backArm: p.backArm || { el: [sh[0] - 0.1, sh[1] + 0.6], hand: [sh[0] - 0.05, sh[1] + 1.15] },
    frontArm: p.frontArm || { el: [sh[0] + 0.08, sh[1] + 0.6], hand: [sh[0] + 0.12, sh[1] + 1.15] },
  };
}
// planted-foot walk cycle (from the proof of concept)
function walkPose(o, ph, S, extra = {}) {
  const leg = (q) => { q = ((q % 1) + 1) % 1; if (q < 0.5) { const x = S / 2 - (q / 0.5) * S; return { knee: [x * 0.55 + 0.05, -0.95], foot: [x, 0] }; } const r = (q - 0.5) / 0.5, x = -S / 2 + r * S, lift = Math.sin(r * Math.PI) * 0.3; return { knee: [x * 0.6 + 0.15, -0.95 - lift * 0.4], foot: [x, -lift], toe: -0.3 * lift }; };
  const bob = -0.06 * (1 - Math.cos(ph * 2 * TAU)) / 2;
  return pose(o, { hip: [0, -1.85 + bob], kick: Math.sin(ph * TAU) * 0.08, frontLeg: leg(ph), backLeg: leg(ph + 0.5), ...extra });
}

// ---------------- materials ----------------
const clothMaps = pbr("cloth", { repeat: [3, 3] });
const mats = new Map();
function mat(key, make) { if (!mats.has(key)) mats.set(key, make()); return mats.get(key); }
const wool = (hex) => mat(`wool${hex}`, () => new THREE.MeshStandardMaterial({ color: hex, roughness: 1, normalMap: clothMaps.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughnessMap: clothMaps.roughnessMap }));
const plain = (hex, roughness = 0.8, metalness = 0) => mat(`p${hex}${roughness}${metalness}`, () => new THREE.MeshStandardMaterial({ color: hex, roughness, metalness }));
const woodMat = () => mat("wood", () => { const m = pbr("hull", { repeat: [0.5, 0.5] }); return new THREE.MeshStandardMaterial({ ...m, color: 0xd9ab7e }); });
const skinMat = () => plain(C.skin, 0.7);
const leather = () => plain("#4a3326", 0.75);
const darker = (hex, f = 0.75) => "#" + new THREE.Color(hex).multiplyScalar(f).getHexString();

// ---------------- shared geometry ----------------
const UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);
const geos = new Map();
function geo(key, make) { if (!geos.has(key)) geos.set(key, make()); return geos.get(key); }
// tapered segment hanging down from its joint along -y
const limb = (r0, r1, len) => geo(`limb${r0}${r1}${len}`, () => new THREE.CylinderGeometry(r0, r1, len, 10, 1).translate(0, -len / 2, 0));
const ball = (r) => geo(`ball${r}`, () => new THREE.SphereGeometry(r, 12, 8));
// unit stick along +y, scaled to length at run time
const stickGeo = (r) => geo(`stick${r}`, () => new THREE.CylinderGeometry(r, r, 1, 6).translate(0, 0.5, 0));
// lathe profiles must run bottom to top for outward-facing surfaces, so downward lists are reversed
const lathe = (key, pts, segs = 18) => geo(key, () => new THREE.LatheGeometry((pts[0][1] > pts.at(-1)[1] ? [...pts].reverse() : pts).map(([r, y]) => new THREE.Vector2(r, y)), segs));

function mesh(g, m, parent, shadow = true) { const o = new THREE.Mesh(g, m); o.castShadow = shadow; o.receiveShadow = true; parent.add(o); return o; }
// point a mesh whose geometry hangs along -y (or +y) from `a` toward `b`
const tq = new THREE.Vector3();
function aim(o, a, b, axis = DOWN) { o.position.copy(a); tq.subVectors(b, a); const L = tq.length(); if (L > 1e-6) o.quaternion.setFromUnitVectors(axis, tq.divideScalar(L)); return L; }
function stick(o, a, b) { const L = aim(o, a, b, UP); o.scale.set(1, L, 1); }

// ---------------- a person ----------------
// Each person is a skinned body: one mesh per body part that bends smoothly at the joints,
// driven by a flat set of bones that setPose aims joint to joint. Heads, hands and shoes are rigid.
const UA = 0.6 * CUB, FA = 0.55 * CUB, TH = 0.9 * CUB, SH = 0.86 * CUB;
const HIP_Y = 1.85 * CUB, SHO_Y = 3.0 * CUB, ARM_LAT = 0.205, LEG_LAT = 0.1025;
const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);

// soft wool: physical sheen gives the fuzzy highlight real cloth has in sunlight
const woolSheen = (hex) => mat(`wool2${hex}`, () => new THREE.MeshPhysicalMaterial({ color: hex, roughness: 1, sheen: 0.35, sheenRoughness: 0.8, sheenColor: new THREE.Color(hex).multiplyScalar(0.9), normalMap: clothMaps.normalMap, normalScale: new THREE.Vector2(0.7, 0.7) }));
const skinPhys = () => mat("skin2", () => new THREE.MeshPhysicalMaterial({ color: C.skin, roughness: 0.58, sheen: 0.35, sheenRoughness: 0.5, sheenColor: new THREE.Color("#f2c4b0") }));
// strands for hair and beards: many fine curved strokes on a transparent card
const hairTex = (() => { let t; return () => t || (t = (() => {
  const c = document.createElement("canvas"); c.width = 128; c.height = 256; const x = c.getContext("2d"), R = rngFrom(77);
  for (let i = 0; i < 900; i++) { const px = R() * 128, w = 0.6 + R() * 1.2, len = 80 + R() * 170, bend = (R() - 0.5) * 18, v = 150 + R() * 105; x.strokeStyle = `rgba(${v},${v},${v},${0.55 + R() * 0.45})`; x.lineWidth = w; x.beginPath(); x.moveTo(px, 0); x.quadraticCurveTo(px + bend, len / 2, px + bend * 0.4, len); x.stroke(); }
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = THREE.RepeatWrapping; tx.repeat.set(3, 1); return tx;
})()); })();
const hairMat = (hex) => mat(`hair2${hex}`, () => new THREE.MeshStandardMaterial({ color: hex, map: hairTex(), alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.7 }));

// A skinned tube along a vertical chain in rest pose. rings: list of [s, rx, rz] from the top,
// s in meters down the chain. weights(s, x, z) returns [[boneIndex, weight], ...].
function skinTube(bones, rings, weights, { x0 = 0, y0 = 0, z0 = 0, segs = 16, up = false, folds = 0, groups = null } = {}) {
  const pos = [], uv = [], si = [], sw = [], idx = [], n = rings.length;
  const total = rings[n - 1][0];
  rings.forEach(([s, rx, rz], i) => {
    for (let k = 0; k <= segs; k++) {
      const a = (k / segs) * TAU, fold = folds ? 1 + folds * Math.sin(a * 13) * smooth(0.05, 0.3, s) : 1;
      const x = x0 + Math.sin(a) * rx * fold, z = z0 + Math.cos(a) * rz * fold, y = up ? y0 + s : y0 - s;
      pos.push(x, y, z); uv.push(k / segs, s / total);
      const w = weights(s, x - x0, z - z0).concat([[0, 0], [0, 0], [0, 0], [0, 0]]).slice(0, 4), sum = w.reduce((t, [, v]) => t + v, 0) || 1;
      si.push(...w.map(([b]) => b)); sw.push(...w.map(([, v]) => v / sum));
    }
  });
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < segs; k++) { const a = i * (segs + 1) + k, b = a + segs + 1; if (up) idx.push(a, a + 1, b, b, a + 1, b + 1); else idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(idx); g.computeVertexNormals();
  if (groups) { g.clearGroups(); for (const [from, to, m] of groups) { const r0 = rings.findIndex(([s]) => s >= from), r1 = rings.findIndex(([s]) => s >= to); g.addGroup(r0 * segs * 6, (r1 - r0) * segs * 6, m); } }
  return g;
}
const blend2 = (b0, b1, at, w = 0.05) => (s) => { const t = smooth(at - w, at + w, s); return [[b0, 1 - t], [b1, t]]; };

// A sculpted head: a sphere pushed and pulled into brow, sockets, nose, cheeks, jaw and chin.
const headGeo = (female) => geo(`head2${female ? "f" : "m"}`, () => {
  const g = new THREE.SphereGeometry(0.1, 48, 36), p = g.attributes.position, d = new THREE.Vector3();
  const bump = (c, s, A) => [new THREE.Vector3(...c).normalize(), s, A];
  const feats = [
    bump([0, 0.3, 0.95], 0.28, female ? 0.03 : 0.06),   // brow ridge
    bump([0.34, 0.13, 0.93], 0.12, -0.11), bump([-0.34, 0.13, 0.93], 0.12, -0.11), // eye sockets
    bump([0, 0.02, 1], 0.075, 0.17), bump([0, -0.13, 1], 0.07, 0.24), // nose bridge and tip
    bump([0.5, -0.05, 0.85], 0.2, 0.05), bump([-0.5, -0.05, 0.85], 0.2, 0.05), // cheekbones
    bump([0, -0.42, 0.9], 0.1, 0.05), bump([0, -0.5, 0.88], 0.08, -0.04), // lips and mouth line
    bump([0, -0.78, 0.62], 0.16, female ? 0.03 : 0.07), // chin
  ];
  for (let i = 0; i < p.count; i++) {
    d.fromBufferAttribute(p, i).normalize();
    let r = 1;
    for (const [c, s, A] of feats) r += A * Math.exp(-c.distanceToSquared(d) / (2 * s * s));
    // narrower jaw toward the chin, flatter back of the head
    const jaw = smooth(0.0, -0.8, d.y), sx = (female ? 0.84 : 0.88) * (1 - 0.18 * jaw * (1 - Math.max(0, d.z))), sz = d.z < 0 ? 0.94 : 1;
    p.setXYZ(i, d.x * 0.1 * r * sx, d.y * 0.1 * r * 1.08, d.z * 0.1 * r * sz * 0.98);
  }
  g.computeVertexNormals(); return g;
});

// a hand: palm, four fingers curled a little, and a thumb
const handGeo = () => geo("hand2", () => {
  const parts = [new THREE.BoxGeometry(0.07, 0.075, 0.028, 2, 2, 1).translate(0, -0.037, 0)];
  for (let f = 0; f < 4; f++) parts.push(new THREE.CapsuleGeometry(0.0085, 0.045 - Math.abs(f - 1.5) * 0.006, 3, 6).rotateX(0.5).translate(-0.026 + f * 0.0175, -0.092, 0.01));
  parts.push(new THREE.CapsuleGeometry(0.01, 0.035, 3, 6).rotateZ(0.7).translate(0.042, -0.035, 0.012));
  return mergeGeometries(parts.map((g) => g.toNonIndexed()));
});

// leg wraps: wool bands wound diagonally from ankle to knee
function wrapMat(hex) {
  return mat(`wrap${hex}`, () => {
    const c = document.createElement("canvas"); c.width = 64; c.height = 64; const x = c.getContext("2d"), base = new THREE.Color(hex);
    x.fillStyle = `#${base.getHexString()}`; x.fillRect(0, 0, 64, 64);
    for (let i = -2; i < 6; i++) { x.strokeStyle = `#${base.clone().multiplyScalar(0.62).getHexString()}`; x.lineWidth = 2; x.beginPath(); x.moveTo(0, i * 16); x.lineTo(64, i * 16 + 22); x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 3);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 1, normalMap: clothMaps.normalMap, normalScale: new THREE.Vector2(0.5, 0.5) });
  });
}
// ankle-high turnshoe with a rounded toe
const shoeGeo = () => geo("shoe", () => mergeGeometries([new THREE.SphereGeometry(0.055, 12, 8).scale(0.8, 0.6, 2).translate(0, 0.032, 0.05), new THREE.CylinderGeometry(0.048, 0.052, 0.08, 10).translate(0, 0.07, -0.01)]));

// pull the lower edge of a hair shell into uneven locks so it does not read as a helmet
function ragged(g, amount = 0.025, seed = 5) {
  const p = g.attributes.position, R = rngFrom(seed), clumps = Array.from({ length: 24 }, () => R());
  let minY = Infinity; for (let i = 0; i < p.count; i++) minY = Math.min(minY, p.getY(i));
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), edge = Math.max(0, 1 - (y - minY) / 0.05);
    const k = Math.floor(((Math.atan2(z, x) / TAU) + 0.5) * 24) % 24;
    p.setY(i, y - edge * amount * (0.3 + clumps[k]));
  }
  g.computeVertexNormals(); return g;
}

class Person {
  constructor(o) {
    this.o = o; this.g = new THREE.Group();
    const g = this.g, female = !!o.dress, skin = skinPhys(), hairCol = o.hair || C.hairBrown, hairSolid = plain(hairCol, 0.9), hairStrands = hairMat(hairCol);
    const body = woolSheen(female ? o.under : o.tunic), legM = woolSheen(o.leg || C.undyedGrey), wrapM = wrapMat(o.wrap || "#5a4a3a");
    // bones, all direct children of the person so setPose can aim each one on its own
    const names = ["pelvis", "spine", "uaL", "faL", "uaR", "faR", "thL", "shL", "thR", "shR"];
    this.b = {}; const bones = names.map((n) => { const bone = new THREE.Bone(); bone.name = n; this.b[n] = bone; g.add(bone); return bone; });
    const I = Object.fromEntries(names.map((n, i) => [n, i]));
    const rest = { pelvis: [0, HIP_Y, 0], spine: [0, HIP_Y, 0], uaL: [-ARM_LAT, SHO_Y - 0.04, 0], faL: [-ARM_LAT, SHO_Y - 0.04 - UA, 0], uaR: [ARM_LAT, SHO_Y - 0.04, 0], faR: [ARM_LAT, SHO_Y - 0.04 - UA, 0], thL: [-LEG_LAT, HIP_Y, 0], shL: [-LEG_LAT, HIP_Y - TH, 0], thR: [LEG_LAT, HIP_Y, 0], shR: [LEG_LAT, HIP_Y - TH, 0] };
    for (const n of names) this.b[n].position.set(...rest[n]);
    g.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton(bones);
    const skinned = (geom, m) => { const sm = new THREE.SkinnedMesh(geom, m); sm.castShadow = true; sm.receiveShadow = true; sm.frustumCulled = false; g.add(sm); sm.bind(skeleton); return sm; };

    // torso: from below the belt to the shoulders, wider at the chest, flattened front to back
    const torsoRings = [[-0.06, 0.165, 0.13], [0, 0.168, 0.13], [0.12, 0.178, 0.135], [0.3, 0.18, 0.13], [0.42, 0.205, 0.14], [0.5, 0.2, 0.13], [0.55, 0.15, 0.1], [0.58, 0.07, 0.06], [0.6, 0.05, 0.05]].map(([s, rx, rz]) => [s + 0.06, rx * (female ? 0.95 : 1), rz * (female ? 1.04 : 1)]);
    skinned(skinTube(bones, torsoRings, (s) => { const t = smooth(0.06, 0.2, s); return [[I.pelvis, 1 - t], [I.spine, t]]; }, { y0: HIP_Y - 0.06, up: true, segs: 28 }), body);
    // skirt: the tunic or the long linen shift, following the thighs part of the way
    const skirtLen = female ? 0.8 : 0.45, flare = female ? 0.24 : 0.27;
    const skirtRings = []; for (let i = 0; i <= 8; i++) { const s = (i / 8) * skirtLen; skirtRings.push([s, lerp(0.17, flare, smooth(0, skirtLen, s) ** 0.8), lerp(0.135, flare * 0.85, smooth(0, skirtLen, s) ** 0.8)]); }
    const skirtW = (s, x) => { const t = (s / skirtLen) * (female ? 0.35 : 0.6), l = 1 / (1 + Math.exp(x / 0.04)); return [[I.pelvis, 1 - t], [I.thL, t * l], [I.thR, t * (1 - l)]]; };
    skinned(skinTube(bones, skirtRings, skirtW, { y0: HIP_Y, segs: 40, folds: female ? 0.03 : 0.045 }), body);
    if (female) {
      // wool apron dress over the shift, from the armpits to mid-calf, on two straps with brooches
      const apron = woolSheen(o.tunic);
      const aTop = [[0.0, 0.19, 0.155], [0.2, 0.192, 0.155], [0.38, 0.2, 0.16], [0.43, 0.2, 0.158]];
      skinned(skinTube(bones, aTop, (s) => { const t = smooth(0.0, 0.12, s); return [[I.pelvis, 1 - t], [I.spine, t]]; }, { y0: HIP_Y, up: true, segs: 28 }), apron);
      const aRings = []; for (let i = 0; i <= 8; i++) { const s = (i / 8) * 0.64; aRings.push([s, lerp(0.19, 0.27, smooth(0, 0.64, s) ** 0.8), lerp(0.158, 0.23, smooth(0, 0.64, s) ** 0.8)]); }
      skinned(skinTube(bones, aRings, (s, x) => { const t = (s / 0.64) * 0.35, l = 1 / (1 + Math.exp(x / 0.04)); return [[I.pelvis, 1 - t], [I.thL, t * l], [I.thR, t * (1 - l)]]; }, { y0: HIP_Y, segs: 40, folds: 0.03 }), apron);
    }
    // arms: one tube from shoulder to wrist, bending at the elbow
    for (const [side, ua, fa, lat] of [["back", "uaL", "faL", -ARM_LAT], ["front", "uaR", "faR", ARM_LAT]]) {
      const rings = [[0, 0.064, 0.062], [0.06, 0.06, 0.058], [0.13, 0.056, 0.058], [0.22, 0.05, 0.05], [UA, 0.047, 0.045], [UA + 0.08, 0.044, 0.042], [UA + FA - 0.02, 0.036, 0.034], [UA + FA, 0.034, 0.032]];
      skinned(skinTube(bones, rings, blend2(I[ua], I[fa], UA, 0.04), { x0: lat, y0: SHO_Y - 0.04, segs: 18 }), body);
      void side;
    }
    // legs: trousers to the knee, wound leg wraps below (men only, the shift covers the woman's legs)
    if (!female) for (const [th, sh, lat] of [["thL", "shL", -LEG_LAT], ["thR", "shR", LEG_LAT]]) {
      const rings = [[0, 0.09, 0.09], [0.15, 0.08, 0.082], [TH - 0.05, 0.066, 0.068], [TH, 0.065, 0.066], [TH + 0.08, 0.062, 0.064], [TH + 0.2, 0.06, 0.062], [TH + SH - 0.06, 0.047, 0.048], [TH + SH, 0.046, 0.047]];
      const geom = skinTube(bones, rings, blend2(I[th], I[sh], TH, 0.05), { x0: lat, y0: HIP_Y, segs: 18, groups: [[0, TH + 0.08, 0], [TH + 0.08, TH + SH, 1]] });
      skinned(geom, [legM, wrapM]);
    }
    this.skeleton = skeleton;

    // belt, buckle, knife and trim ride on the pelvis bone; the cloak and brooches on the spine bone
    const pelvisAcc = new THREE.Group(), spineAcc = new THREE.Group(); this.b.pelvis.add(pelvisAcc); this.b.spine.add(spineAcc);
    if (female) {
      for (const sd of [1, -1]) {
        mesh(geo("strap2", () => new THREE.TorusGeometry(0.115, 0.014, 4, 12, Math.PI).rotateY(Math.PI / 2).scale(1, 0.5, 1.2)), woolSheen(o.tunic), spineAcc).position.set(sd * 0.09, 0.43, 0);
        mesh(geo("brooch", () => new THREE.SphereGeometry(0.036, 14, 8, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(0.72, 1, 0.55)), plain(C.bronze, 0.35, 0.85), spineAcc).position.set(sd * 0.09, 0.43, 0.16);
      }
      for (let i = 0; i < 11; i++) { const t = i / 10; mesh(ball(0.0105), plain(["#b03a2e", "#2f6f9a", "#d9b44a", "#3e7a4a"][i % 4], 0.35), spineAcc, false).position.set(lerp(-0.085, 0.085, t), 0.405 - Math.sin(t * Math.PI) * 0.075, 0.167); }
      mesh(geo("shawl2", () => new THREE.SphereGeometry(0.23, 20, 8, Math.PI * 0.62, Math.PI * 1.76, Math.PI * 0.3, Math.PI * 0.2).scale(1, 1.1, 0.78)), woolSheen(o.shawl), spineAcc).position.y = 0.39;
      const third = new THREE.Group(); for (let k = 0; k < 3; k++) mesh(ball(0.016), plain(C.bronze, 0.35, 0.85), third, false).position.set(Math.cos((k / 3) * TAU) * 0.016, Math.sin((k / 3) * TAU) * 0.016, 0);
      third.position.set(0, 0.48, 0.155); spineAcc.add(third);
    } else {
      mesh(geo("belt2", () => new THREE.TorusGeometry(1, 0.1, 6, 24).rotateX(Math.PI / 2).scale(0.172, 0.16, 0.138)), leather(), pelvisAcc).position.y = 0.005;
      mesh(geo("buckle", () => new THREE.BoxGeometry(0.035, 0.032, 0.012)), plain(C.bronze, 0.35, 0.85), pelvisAcc).position.set(0, 0.005, 0.142);
      const knife = new THREE.Group(); knife.position.set(-0.11, -0.01, 0.105); knife.rotation.set(0.1, 0.4, 0.5); pelvisAcc.add(knife);
      mesh(geo("sheath", () => new THREE.BoxGeometry(0.03, 0.17, 0.018).translate(0, -0.085, 0)), leather(), knife);
      mesh(geo("hilt", () => new THREE.CylinderGeometry(0.012, 0.013, 0.08, 8).translate(0, 0.04, 0)), plain("#8a6a46", 0.7), knife);
      if (o.trim) {
        mesh(geo("neckTrim2", () => new THREE.TorusGeometry(0.068, 0.009, 4, 20).rotateX(Math.PI / 2)), plain(o.trim, 0.5, 0.2), spineAcc).position.y = 0.6;
      }
    }
    if (o.cloak) {
      // a draped cloak: narrow at the shoulders, wide at the hem, with folds, open at the front right
      const cloakGeo = geo("cloak3", () => {
        const g2 = new THREE.CylinderGeometry(0.2, 0.36, 0.95, 40, 12, true, Math.PI * 0.32, Math.PI * 1.3), p = g2.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i), down = (0.475 - y) / 0.95, a = Math.atan2(x, z);
          const fold = 1 + Math.sin(a * 9 + down * 2) * 0.06 * down; // folds deepen toward the hem
          p.setXYZ(i, x * fold, y - Math.max(0, Math.sin(a - 0.4)) * 0.05 * down, z * fold * 0.85); // hem dips at the back
        }
        g2.translate(0, -0.42, 0); g2.computeVertexNormals(); return g2;
      });
      const cloakMat = mat(`cloak${o.cloak}`, () => { const m2 = woolSheen(o.cloak).clone(); m2.side = THREE.DoubleSide; return m2; });
      mesh(cloakGeo, cloakMat, spineAcc).position.y = 0.6;
      mesh(geo("ringPin", () => new THREE.TorusGeometry(0.028, 0.006, 6, 16)), plain(C.bronze, 0.35, 0.85), spineAcc).position.set(0.13, 0.53, 0.12);
    }

    // head
    this.head = new THREE.Group(); g.add(this.head);
    mesh(headGeo(female), skin, this.head);
    mesh(limb(0.045, 0.052, 0.11), skin, this.head).position.y = -0.065;
    for (const sd of [1, -1]) {
      const ear = mesh(ball(0.022), skin, this.head); ear.position.set(sd * 0.086, -0.005, -0.008); ear.scale.set(0.4, 1, 0.75);
      mesh(ball(0.0098), plain("#e8ded2", 0.25), this.head, false).position.set(sd * 0.031, 0.012, 0.08);
      mesh(ball(0.0058), plain(o.eyes || "#4a5a6a", 0.2), this.head, false).position.set(sd * 0.031, 0.011, 0.0868);
      mesh(geo("lid", () => new THREE.SphereGeometry(0.0108, 12, 6, 0, TAU, 0, Math.PI * 0.42)), skin, this.head, false).position.set(sd * 0.031, 0.0125, 0.0802);
      mesh(geo("brow2", () => new THREE.CapsuleGeometry(0.004, 0.026, 2, 4).rotateZ(Math.PI / 2)), hairSolid, this.head, false).position.set(sd * 0.032, 0.033, 0.091);
    }
    const style = o.hairStyle || "collar";
    const shell = (key, make, m, s = 1) => { const h = mesh(geo(key, make), m, this.head); h.scale.setScalar(s); return h; };
    const cap = () => new THREE.SphereGeometry(0.106, 18, 10, 0, TAU, 0, Math.PI * 0.36);
    shell("skull", cap, o.cap ? woolSheen(o.cap) : hairSolid).position.set(0, 0.016, -0.004);
    if (!o.cap) shell("skull", cap, hairStrands, 1.05).position.set(0, 0.016, -0.004);
    const backShort = () => ragged(new THREE.SphereGeometry(0.108, 28, 12, Math.PI * 0.78, Math.PI * 1.44, 0, Math.PI * 0.5), 0.018, 6);
    const backLong = () => ragged(new THREE.SphereGeometry(0.11, 28, 14, Math.PI * 0.8, Math.PI * 1.4, 0, Math.PI * 0.66), 0.035, 7);
    if (style === "fringe") {
      shell("fringe", () => ragged(new THREE.SphereGeometry(0.11, 24, 8, Math.PI * 0.16, Math.PI * 0.68, Math.PI * 0.16, Math.PI * 0.22), 0.02, 8), hairStrands, 1.02).position.set(0, 0.012, 0.006);
      shell("hairBackShort", backShort, hairSolid).position.y = 0.012; shell("hairBackShort", backShort, hairStrands, 1.05).position.y = 0.012;
    } else if (style === "collar" || style === "knot") {
      shell("hairBackLong", backLong, hairSolid).position.y = 0.01; shell("hairBackLong", backLong, hairStrands, 1.05).position.y = 0.01;
      if (style === "collar") shell("hairNape", () => new THREE.CylinderGeometry(0.08, 0.09, 0.1, 14, 1, true, Math.PI * 0.75, Math.PI * 1.5), hairStrands).position.set(0, -0.06, -0.012);
      else { mesh(ball(0.045), hairSolid, this.head).position.set(0, -0.03, -0.11); mesh(ball(0.048), hairStrands, this.head).position.set(0, -0.03, -0.11); }
    } else { shell("hairBackShort", backShort, hairSolid).position.y = 0.012; shell("hairBackShort", backShort, hairStrands, 1.05).position.y = 0.012; }
    if (o.cap) mesh(geo("cap", () => new THREE.SphereGeometry(0.113, 16, 8, 0, TAU, 0, Math.PI * 0.42).scale(1, 1.18, 1)), woolSheen(o.cap), this.head).position.y = 0.02;
    if (o.beard === "full") { const bg = () => new THREE.SphereGeometry(0.08, 16, 10, 0, TAU, Math.PI * 0.42, Math.PI * 0.58).scale(1, 1.25, 0.9); mesh(geo("beard2", bg), hairSolid, this.head).position.set(0, -0.045, 0.03); const bs = mesh(geo("beard2", bg), hairStrands, this.head); bs.position.set(0, -0.045, 0.032); bs.scale.setScalar(1.06); }
    if (o.beard === "full" || o.beard === "moustache") mesh(geo("moustache2", () => new THREE.CapsuleGeometry(0.008, 0.045, 3, 6).rotateZ(Math.PI / 2 - 0.25)), hairSolid, this.head, false).position.set(0, -0.034, 0.1);
    if (o.beard === "moustache") mesh(ball(0.018), hairSolid, this.head, false).position.set(0, -0.09, 0.075);

    // hands and turnshoes
    this.hand = {}; this.foot = {};
    for (const side of ["back", "front"]) {
      this.hand[side] = mesh(handGeo(), skin, g);
      if (o.trim) mesh(geo("cuff2", () => new THREE.TorusGeometry(0.036, 0.008, 4, 14).rotateX(Math.PI / 2)), plain(o.trim, 0.5, 0.2), this.hand[side]).position.y = 0.012;
      this.foot[side] = mesh(shoeGeo(), leather(), g);
      (this.shoulder ||= {})[side] = mesh(ball(female ? 0.056 : 0.07), body, g); this.shoulder[side].scale.set(1, 0.9, 0.95);
    }
    this.hands = { back: new THREE.Vector3(), front: new THREE.Vector3() };
    this.mirror = 1;
  }
  // map a 2D pose point (cubits) to this figure's local frame
  v(p, lat = 0, out = new THREE.Vector3()) { return out.set(lat, -p[1] * CUB, this.mirror * p[0] * CUB); }
  setPose(pd) {
    const b = this.b, H = this.v(pd.hip), S = this.v(pd.sh);
    b.pelvis.position.copy(H); b.pelvis.rotation.set(-pd.kick * this.mirror * 0.6, 0, 0);
    aim(b.spine, H, S, UP);
    const hc = this.v([pd.sh[0] + 0.08 + pd.headX, pd.sh[1] - 0.42 + pd.headY]);
    this.head.position.copy(hc); this.head.rotation.set(0, this.mirror < 0 ? Math.PI : 0, 0);
    const a = new THREE.Vector3(), t = new THREE.Vector3(), c = new THREE.Vector3();
    for (const [side, ua, fa, th, sh, lat] of [["back", "uaL", "faL", "thL", "shL", -ARM_LAT], ["front", "uaR", "faR", "thR", "shR", ARM_LAT]]) {
      const arm = pd[`${side}Arm`], leg = pd[`${side}Leg`];
      // arm: shoulder to elbow to wrist with fixed lengths, so hands land near their targets
      a.copy(S).add(tq.set(lat, -0.04, 0));
      this.shoulder[side].position.copy(a).add(tq.set(lat * 0.08, 0.005, 0));
      this.v(arm.el, lat, t); aim(b[ua], a, t); a.add(t.sub(a).normalize().multiplyScalar(UA));
      this.v(arm.hand, lat, t); aim(b[fa], a, t); const dir = t.sub(a).normalize(); a.addScaledVector(dir, FA);
      this.hand[side].position.copy(a); this.hand[side].quaternion.copy(b[fa].quaternion);
      this.hands[side].copy(a).addScaledVector(dir, 0.045);
      // leg: hip to knee to ankle, the foot flat and pointing forward
      const ll = lat * 0.5;
      a.copy(H).add(tq.set(ll, 0, 0)); this.v(leg.knee, ll, t); this.v(leg.foot, ll, c); c.y += 0.07;
      aim(b[th], a, t); a.add(t.sub(a).normalize().multiplyScalar(TH)); aim(b[sh], a, c); a.add(c.sub(a).normalize().multiplyScalar(SH));
      if (this.o.dress) a.copy(c);
      this.foot[side].position.set(a.x, Math.max(0, a.y - 0.07), a.z); this.foot[side].rotation.set(-(leg.toe || 0) * this.mirror, this.mirror < 0 ? Math.PI : 0, 0);
    }
  }
}

// ---------------- animals ----------------
// Horses and dogs use the same kit as the people: a skinned body on a flat bone rig, a sculpted
// head, and strand hair for manes and tails. Proportions follow small Viking Age horses
// (about 1.3 m at the withers) and a medium dog. Coat colours and the dog's type are reconstruction.
const coatMat = (hex, sheen = 0.5) => mat(`coat${hex}${sheen}`, () => new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.6, sheen, sheenRoughness: 0.45, sheenColor: new THREE.Color(hex).lerp(new THREE.Color("#fff3e0"), 0.25), normalMap: clothMaps.normalMap, normalScale: new THREE.Vector2(0.25, 0.25) }));

// a skinned body lofted along +z; rings are [z, top, bottom, half width]
function loftZ(rings, boneIndex, segs = 28) {
  const pos = [], uv = [], si = [], sw = [], idx = [];
  rings.forEach(([z, top, bot, hw], i) => {
    const cy = (top + bot) / 2, ry = (top - bot) / 2;
    for (let k = 0; k <= segs; k++) { const a = (k / segs) * TAU; pos.push(Math.sin(a) * hw, cy + Math.cos(a) * ry, z); uv.push(k / segs, i / (rings.length - 1)); si.push(boneIndex, 0, 0, 0); sw.push(1, 0, 0, 0); }
  });
  for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < segs; k++) { const a = i * (segs + 1) + k, b = a + segs + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(idx); g.computeVertexNormals();
  // make sure the top of the body faces up
  if (g.attributes.normal.getY(Math.floor(rings.length / 2) * (segs + 1)) < 0) { g.index.array.reverse(); g.computeVertexNormals(); }
  return g;
}
// a sculpted animal head along +z from the back of the skull (0) to the muzzle (len)
const animalHead = (key, len, rBack, rFront, flat, jowl) => geo(key, () => {
  const g = new THREE.SphereGeometry(1, 36, 24), p = g.attributes.position, d = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    d.fromBufferAttribute(p, i);
    const t = (d.z + 1) / 2, r = lerp(rBack, rFront, Math.pow(t, 0.75)) * (1 + jowl * Math.exp(-((t - 0.18) ** 2) / 0.02) * Math.max(0, -d.y));
    const top = d.y > 0 ? 0.88 : 1; // flat forehead and nose bridge
    p.setXYZ(i, d.x * r * flat, d.y * r * top, t * len);
  }
  g.computeVertexNormals(); return g;
});

function buildQuad(g, Q) {
  const coat = coatMat(Q.coat), points = coatMat(Q.points, 0.3), hairM = hairMat(Q.hair), hairSolid = plain(Q.hair, 0.85);
  const names = ["body", "neck1", "neck2", "lfU", "lfL", "rfU", "rfL", "lhU", "lhL", "rhU", "rhL"];
  const A = {}; const bones = names.map((n) => { const b = new THREE.Bone(); A[n] = b; g.add(b); return b; }); const I = Object.fromEntries(names.map((n, i) => [n, i]));
  const nb = new THREE.Vector3(...Q.neckBase);
  A.neck1.position.copy(nb); A.neck2.position.copy(nb).add(new THREE.Vector3(0, Q.neckSeg, 0));
  const legs = Q.legs.map(([key, z, lat, top, joint, foot, rU, rJ, rL]) => {
    A[`${key}U`].position.set(lat, top, z); A[`${key}L`].position.set(lat, joint, z);
    // pastern and hoof below the fetlock
    const hoof = new THREE.Group(); g.add(hoof);
    mesh(limb(rL * 1.05, rL * 1.2, foot * 0.55), coatMat(Q.points, 0.3), hoof);
    mesh(geo(`${Q.kind}Hoof`, () => new THREE.CylinderGeometry(rL * 1.15, rL * 1.45, foot * 0.5, 12).translate(0, -foot * 0.75, 0.01)), plain("#2b241e", 0.55), hoof);
    return { key, z, lat, top, joint, foot, hind: key.endsWith("h"), hoof };
  });
  g.updateMatrixWorld(true);
  const skel = new THREE.Skeleton(bones);
  const skinned = (geom, m) => { const sm = new THREE.SkinnedMesh(geom, m); sm.castShadow = true; sm.receiveShadow = true; sm.frustumCulled = false; g.add(sm); sm.bind(skel); return sm; };
  skinned(loftZ(Q.body, I.body), coat);
  // neck, vertical in the rest pose; the crest is on its back (-z) side so it ends up on top
  skinned(skinTube(bones, Q.neckRings, blend2(I.neck1, I.neck2, Q.neckSeg, 0.08), { x0: 0, y0: nb.y, z0: nb.z, up: true, segs: 20 }), coat);
  // legs: upper leg in the coat colour, darker below the knee or hock
  for (const L of Q.legs) {
    const [key, z, lat, top, joint, foot, rU, rJ, rL] = L, l1 = top - joint, l2 = joint - foot;
    const rings = [[0, rU, rU * 1.1], [l1 * 0.5, rU * 0.8, rU * 0.95], [l1 - 0.03, rJ, rJ * 1.1], [l1, rJ, rJ * 1.15], [l1 + 0.05, rL * 1.15, rL * 1.2], [l1 + l2 - 0.02, rL, rL * 1.1], [l1 + l2, rL * 1.15, rL * 1.2]];
    skinned(skinTube(bones, rings, blend2(I[`${key}U`], I[`${key}L`], l1, 0.04), { x0: lat, y0: top, z0: z, segs: 14, groups: [[0, l1 * 0.8, 0], [l1 * 0.8, l1 + l2, 1]] }), [coat, points]);
  }
  // mane: strands hanging from the crest down one side of the neck
  if (Q.mane) {
    const pos = [], uv = [], si = [], sw = [], idx = [], n = 10, len = Q.neckSeg * 2;
    for (let i = 0; i <= n; i++) {
      const s = (i / n) * len, y = nb.y + s, rz = lerp(Q.neckRings[0][2], Q.neckRings.at(-1)[2], i / n), t = smooth(Q.neckSeg - 0.08, Q.neckSeg + 0.08, s);
      for (const [dx, dz, v] of [[0, -rz - 0.01, 0], [Q.mane, -rz * 0.35, 1]]) { pos.push(dx, y + (v ? -0.06 : 0.02), nb.z + dz); uv.push(i / n * 3, v); si.push(I.neck1, I.neck2, 0, 0); sw.push(1 - t, t, 0, 0); }
    }
    for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const mg = new THREE.BufferGeometry(); mg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); mg.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    mg.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4)); mg.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4)); mg.setIndex(idx); mg.computeVertexNormals();
    skinned(mg, hairM); const m2 = skinned(mg, hairM); m2.position.x = -0.012;
  }
  // head
  const head = new THREE.Group(); g.add(head);
  const [hl, hb, hf, hflat, hjowl] = Q.head;
  mesh(animalHead(`${Q.kind}Head`, hl, hb, hf, hflat, hjowl), coat, head);
  for (const sd of [1, -1]) {
    mesh(ball(Q.eye), plain("#1a120d", 0.15), head, false).position.set(sd * hb * hflat * 0.92, hb * 0.35, hl * 0.22);
    mesh(ball(Q.eye * 0.9), plain("#120c09", 0.5), head, false).position.set(sd * hf * hflat * 0.55, -hf * 0.1, hl * 0.97);
    const ear = mesh(geo(`${Q.kind}Ear`, () => new THREE.ConeGeometry(Q.ear[0], Q.ear[1], 8).translate(0, Q.ear[1] / 2, 0).scale(1, 1, 0.55)), coat, head);
    ear.position.set(sd * hb * 0.55, hb * 0.75, hl * 0.06); ear.rotation.set(-0.15, 0, -sd * 0.25);
  }
  if (Q.forelock) mesh(geo("forelock", () => new THREE.PlaneGeometry(0.1, 0.18).translate(0, -0.09, 0)), hairM, head).position.set(0, hb * 0.95, hl * 0.12);
  // tail
  const tail = new THREE.Group(); tail.position.set(...Q.tailRoot); g.add(tail);
  if (Q.kind === "horse") {
    mesh(limb(0.05, 0.035, 0.22), points, tail);
    // a tapering bundle of hair: two nested open cones of strands
    for (const [r, len] of [[0.075, 0.74], [0.05, 0.66]]) mesh(geo(`tailHair${r}`, () => new THREE.CylinderGeometry(r * 0.7, r * 1.6, len, 14, 1, true).translate(0, -len / 2 - 0.12, 0)), hairM, tail);
  } else {
    // a curled tail, as on northern spitz-type dogs (reconstruction)
    mesh(geo("dogTail", () => new THREE.TorusGeometry(0.075, 0.028, 8, 16, Math.PI * 1.3).rotateY(Math.PI / 2).rotateX(0.4)), coat, tail).position.set(0, 0.06, 0.02);
  }
  return { A, legs, head, tail, nb, Q, hairSolid };
}

// aim the neck from its base through an arched middle to the poll, then hang the head from it
function poseNeck(s, poll, pitch) {
  const { A, nb, head, Q } = s, mid = nb.clone().lerp(poll, 0.5).add(new THREE.Vector3(0, 0.06, -0.04));
  aim(A.neck1, nb, mid, UP); const p2 = nb.clone().add(mid.sub(nb).normalize().multiplyScalar(Q.neckSeg));
  aim(A.neck2, p2, poll, UP); const end = p2.clone().add(poll.clone().sub(p2).normalize().multiplyScalar(Q.neckSeg));
  head.position.copy(end); head.rotation.set(pitch, 0, 0);
}
// aim one leg toward a joint and a foot position
function poseLeg(s, L, jointZ, footZ, lift = 0) {
  const a = new THREE.Vector3(L.lat, L.top, L.z), j = new THREE.Vector3(L.lat, L.joint + lift * 0.5, jointZ), f = new THREE.Vector3(L.lat, L.foot + lift, footZ);
  aim(s.A[`${L.key}U`], a, j); const e = a.add(j.sub(a).normalize().multiplyScalar(L.top - L.joint)); aim(s.A[`${L.key}L`], e, f);
  L.hoof.position.copy(e.add(f.sub(e).normalize().multiplyScalar(L.joint - L.foot)));
}

const HORSE = {
  kind: "horse", coat: "#6a3f26", points: "#221812", hair: "#1c1410", mane: 0.13, forelock: true, eye: 0.022, ear: [0.032, 0.12],
  // rump to chest: [z, top, bottom, half width]
  body: [[-0.8, 1.16, 1.0, 0.06], [-0.76, 1.24, 0.86, 0.17], [-0.62, 1.3, 0.74, 0.23], [-0.4, 1.31, 0.7, 0.26], [-0.15, 1.25, 0.66, 0.27], [0.12, 1.26, 0.67, 0.27], [0.36, 1.33, 0.71, 0.25], [0.52, 1.3, 0.78, 0.21], [0.62, 1.18, 0.86, 0.15], [0.67, 1.06, 0.94, 0.06]],
  neckBase: [0, 1.06, 0.46], neckSeg: 0.36, neckRings: [[0, 0.15, 0.25], [0.2, 0.125, 0.2], [0.4, 0.1, 0.15], [0.6, 0.083, 0.12], [0.72, 0.078, 0.11]],
  // [key, z, lateral, top, knee or hock, fetlock, upper r, joint r, lower r]
  legs: [["lf", 0.44, -0.13, 0.98, 0.48, 0.13, 0.11, 0.06, 0.044], ["rf", 0.44, 0.13, 0.98, 0.48, 0.13, 0.11, 0.06, 0.044], ["lh", -0.55, -0.14, 1.02, 0.52, 0.13, 0.135, 0.062, 0.045], ["rh", -0.55, 0.14, 1.02, 0.52, 0.13, 0.135, 0.062, 0.045]],
  head: [0.56, 0.125, 0.07, 0.62, 0.25], tailRoot: [0, 1.2, -0.8],
};
const DOG = {
  kind: "dog", coat: "#9a7a55", points: "#7a5e40", hair: "#6e5538", mane: 0, forelock: false, eye: 0.009, ear: [0.025, 0.07],
  body: [[-0.32, 0.47, 0.38, 0.03], [-0.29, 0.52, 0.33, 0.09], [-0.18, 0.53, 0.33, 0.1], [-0.02, 0.52, 0.34, 0.1], [0.14, 0.54, 0.3, 0.11], [0.26, 0.55, 0.32, 0.1], [0.33, 0.5, 0.36, 0.06]],
  neckBase: [0, 0.46, 0.25], neckSeg: 0.08, neckRings: [[0, 0.07, 0.09], [0.08, 0.06, 0.07], [0.16, 0.05, 0.06]],
  legs: [["lf", 0.22, -0.06, 0.42, 0.22, 0.03, 0.04, 0.025, 0.02], ["rf", 0.22, 0.06, 0.42, 0.22, 0.03, 0.04, 0.025, 0.02], ["lh", -0.24, -0.065, 0.44, 0.2, 0.03, 0.05, 0.026, 0.02], ["rh", -0.24, 0.065, 0.44, 0.2, 0.03, 0.05, 0.026, 0.02]],
  head: [0.22, 0.07, 0.03, 0.85, 0.2], tailRoot: [0, 0.5, -0.3],
};

// ---------------- props ----------------
function disc(color) {
  const g = new THREE.Group();
  mesh(geo("shieldDisc", () => new THREE.CylinderGeometry(0.44, 0.44, 0.018, 32).rotateX(Math.PI / 2)), plain(color, 0.75), g);
  mesh(geo("shieldBoss", () => new THREE.SphereGeometry(0.075, 12, 6, 0, TAU, 0, Math.PI / 2).scale(1, 0.55, 1).rotateX(Math.PI / 2).translate(0, 0, 0.009)), plain("#6a6460", 0.5, 0.6), g);
  return g;
}
const box = (w, h, d, m, parent) => mesh(new THREE.BoxGeometry(w, h, d), m, parent);
const P2 = (x, y, lat = 0) => new THREE.Vector3(lat, -y * CUB, x * CUB);

// ---------------- the cast: one definition per task loop ----------------
// build(group) returns state, frame(state, ph) poses it for phase ph in [0, 1)
const ACTORS = {
  // shipwright clenching a rivet: hammer up, strike
  wright: { period: 0.9, build(g) { const p = new Person(outfits.wright); g.add(p.g); const handle = mesh(stickGeo(0.016), woodMat(), g), head = box(0.05, 0.05, 0.12, plain(C.iron, 0.5, 0.7), g); return { p, handle, head }; },
    frame(s, ph) {
      const up = ph < 0.6 ? Math.sin((ph / 0.6) * Math.PI / 2) : 1 - (ph - 0.6) / 0.4;
      const hand = [lerp(0.95, 0.75, up), lerp(-2.75, -3.75, up)];
      s.p.setPose(pose(outfits.wright, { lean: 0.12, backArm: { el: [0.45, -2.45], hand: [0.95, -2.5] }, frontArm: { el: [0.45, -2.75 - up * 0.35], hand } }));
      const a = Math.atan2(-1, 0) + (1 - up) * 1.2 - 0.4, h = s.p.hands.front, tip = h.clone().add(new THREE.Vector3(0, -Math.sin(a) * 0.55 * CUB, Math.cos(a) * 0.55 * CUB));
      stick(s.handle, h, tip); s.head.position.copy(tip); s.head.quaternion.copy(s.handle.quaternion);
    } },
  // caulker kneeling, pushing tarred wool into a seam
  caulk: { period: 1.4, build(g) {
      const p = new Person(outfits.caulk); g.add(p.g);
      const pot = mesh(lathe("tarpot", [[0.001, 0], [0.12, 0], [0.13, 0.2], [0.11, 0.27], [0.001, 0.25]]), plain("#2b231d", 0.6), g); pot.position.copy(P2(-1.1, 0)); pot.position.x = -0.15;
      const iron = mesh(stickGeo(0.012), plain(C.iron, 0.5, 0.7), g); return { p, iron }; },
    frame(s, ph) {
      const push = (1 - Math.cos(ph * TAU)) / 2, tool = [lerp(0.95, 1.15, push), -1.75];
      s.p.setPose(pose(outfits.caulk, { hip: [0, -1.05], sh: [0.35, -2.05], backLeg: { knee: [-0.45, -0.15], foot: [-1.0, -0.06] }, frontLeg: { knee: [0.5, -1.05], foot: [0.45, 0] }, backArm: { el: [0.6, -1.6], hand: [tool[0] - 0.15, tool[1] + 0.05] }, frontArm: { el: [0.65, -1.85], hand: [tool[0] - 0.25, tool[1] - 0.05] } }));
      stick(s.iron, P2(tool[0] - 0.35, tool[1]), P2(tool[0] + 0.05, tool[1]));
    } },
  // two crew carrying an oar on their shoulders (the main loop walks this group up and down the beach)
  oars: { period: 1.1, build(g) {
      const a = new Person(outfits.oar2), b = new Person(outfits.oar1); a.g.position.copy(P2(2.3, 0)); b.g.position.copy(P2(6.6, 0)); g.add(a.g, b.g);
      const oar = mesh(stickGeo(0.03), woodMat(), g), blade = box(0.02, 0.13, 0.62, woodMat(), g); return { a, b, oar, blade }; },
    frame(s, ph) {
      const oarY = -3.05 + Math.sin(ph * 2 * TAU) * 0.03;
      s.a.setPose(walkPose(outfits.oar2, (ph + 0.25) % 1, 1.4, { frontArm: { el: [0.35, -2.6], hand: [0.25, -3.12] }, backArm: { el: [-0.25, -2.6], hand: [-0.15, -3.1] } }));
      s.b.setPose(walkPose(outfits.oar1, ph, 1.4, { frontArm: { el: [0.3, -2.6], hand: [0.2, -3.1] }, backArm: { el: [-0.3, -2.6], hand: [-0.2, -3.08] } }));
      const tail = P2(0.3, oarY + 0.05, 0.2), tip = P2(8.6, oarY - 0.05, 0.2); stick(s.oar, tail, tip);
      s.blade.position.copy(P2(0.85, oarY + 0.03, 0.2)); s.blade.quaternion.copy(s.oar.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
    } },
  // crewman on deck lifting a shield onto the rail
  shield: { period: 2.4, build(g) { const p = new Person(outfits.shield); g.add(p.g); const sh = disc(C.shieldY); g.add(sh); return { p, sh }; },
    frame(s, ph) {
      const up = (1 - Math.cos(ph * TAU)) / 2, hand = [lerp(0.55, 0.9, up), lerp(-2.0, -3.0, up)];
      s.p.setPose(pose(outfits.shield, { lean: 0.05 + up * 0.08, backArm: { el: [0.25, -2.45 - up * 0.3], hand: [hand[0] - 0.1, hand[1] + 0.25] }, frontArm: { el: [0.4, -2.35 - up * 0.3], hand: [hand[0] + 0.05, hand[1] - 0.15] } }));
      s.sh.position.copy(P2(hand[0] + 0.35, hand[1]));
    } },
  // steersman with a hand toward the tiller, looking out
  steer: { period: 4, build(g) { const p = new Person(outfits.steer); g.add(p.g); return { p }; },
    frame(s, ph) {
      const sway = Math.sin(ph * TAU);
      s.p.setPose(pose(outfits.steer, { lean: 0.05 * sway, headX: 0.03 * sway, frontArm: { el: [0.45, -2.3], hand: [0.85, -2.0 + sway * 0.04] }, backArm: { el: [0.3, -2.9], hand: [0.25, -3.45] } }));
    } },
  // crewman hauling on the halyard at the mast
  rope: { period: 1.6, build(g) { const p = new Person(outfits.rope); g.add(p.g); const up = mesh(stickGeo(0.011), plain("#8b6b43", 0.95), g), down = mesh(stickGeo(0.011), plain("#8b6b43", 0.95), g); return { p, up, down }; },
    frame(s, ph) {
      const a = Math.sin(ph * TAU), b = Math.sin(ph * TAU + Math.PI);
      s.p.setPose(pose(outfits.rope, { lean: -0.12, backArm: { el: [0.3, -2.8], hand: [0.45, -3.2 + a * 0.45] }, frontArm: { el: [0.32, -2.75], hand: [0.45, -3.2 + b * 0.45] } }));
      const top = s.p.hands.back.y > s.p.hands.front.y ? s.p.hands.back : s.p.hands.front, low = top === s.p.hands.back ? s.p.hands.front : s.p.hands.back;
      stick(s.up, top, new THREE.Vector3(0, 10.4, 0.5)); stick(s.down, low, new THREE.Vector3(-0.25, 0.02, 0.25));
    } },
  // a crewman on the beach heaves a sea chest up to another leaning over the rail
  chest: { period: 2.6, build(g, opts) {
      const a = new Person(outfits.chest1), b = new Person(outfits.chest2); // b turns to face a
      a.g.position.copy(P2(1.3, 0)); b.g.position.copy(P2(3.2, 0)); b.g.position.y = opts.deckLift || 1.6; b.g.rotation.y = Math.PI; g.add(a.g, b.g);
      const chest = new THREE.Group(); box(0.5, 0.34, 0.36, mat("chestwood", () => new THREE.MeshStandardMaterial({ ...pbr("hull", { repeat: [0.4, 0.4] }), color: 0xd6a979 })), chest); box(0.08, 0.1, 0.02, plain(C.iron, 0.5, 0.7), chest).position.set(0, 0.08, 0.185);
      chest.rotation.y = Math.PI / 2; g.add(chest); return { a, b, chest }; },
    frame(s, ph) {
      const up = (1 - Math.cos(ph * TAU)) / 2, cy = lerp(-2.6, -3.7, up);
      s.a.setPose(pose(outfits.chest1, { lean: 0.1, backArm: { el: [0.35, cy + 0.5], hand: [0.75, cy + 0.15] }, frontArm: { el: [0.4, cy + 0.45], hand: [0.85, cy + 0.1] } }));
      s.b.setPose(pose(outfits.chest2, { hip: [0, -1.85], sh: [0.35, -2.85], backArm: { el: [0.75, -2.3], hand: [1.15, -1.9 + (1 - up) * 0.3] }, frontArm: { el: [0.7, -2.25], hand: [1.05, -1.85 + (1 - up) * 0.3] } }));
      s.chest.position.copy(P2(1.3 + 1.1, cy - 0.17));
    } },
  // two players at a gaming board set on a chest
  game: { period: 3.2, build(g) {
      const a = new Person(outfits.game1), b = new Person(outfits.game2);
      a.g.position.copy(P2(0.9, 0)); b.g.position.copy(P2(3.3, 0)); b.g.rotation.y = Math.PI; g.add(a.g, b.g);
      const seat = mat("seat", () => new THREE.MeshStandardMaterial({ ...pbr("hull", { repeat: [0.4, 0.4] }), color: 0xb38a62 }));
      for (const z of [0.85, 3.35]) box(0.36, 0.44, 0.3, seat, g).position.set(0, 0.22, z * CUB);
      box(0.34, 0.44, 0.4, seat, g).position.set(0, 0.22, 2.1 * CUB);
      box(0.46, 0.04, 0.46, woodMat(), g).position.set(0, 0.46, 2.1 * CUB);
      // horn playing pieces, light and dark
      for (let i = 0; i < 14; i++) { const r = new THREE.Vector2(((i * 37) % 9) - 4, ((i * 53) % 9) - 4).multiplyScalar(0.045); mesh(geo("piece", () => new THREE.CylinderGeometry(0.012, 0.016, 0.03, 8)), plain(i % 3 ? "#efe4cf" : "#3a2f28", 0.5), g, false).position.set(r.x, 0.495, 2.1 * CUB + r.y); }
      return { a, b }; },
    frame(s, ph) {
      const reach = ph < 0.4 ? Math.sin((ph / 0.4) * Math.PI) : 0, think = Math.sin(ph * TAU) * 0.03;
      const seat = (o, arm) => pose(o, { hip: [0, -1.05], sh: [0.15, -2.15], headY: think, backLeg: { knee: [0.55, -1.1], foot: [0.6, 0] }, frontLeg: { knee: [0.6, -1.05], foot: [0.7, 0] }, backArm: { el: [0.4, -1.65], hand: [0.6, -1.45] }, frontArm: arm });
      s.a.setPose(seat(outfits.game1, { el: [0.6, -1.85 - reach * 0.1], hand: [0.75 + reach * 0.35, -1.5 - reach * 0.1] }));
      s.b.setPose(seat(outfits.game2, { el: [0.45, -1.8], hand: [0.55, -2.3 + think] }));
    } },
  // the cook stirring a pot that hangs from a tripod over the fire
  cook: { period: 2.2, build(g) {
      const p = new Person(outfits.cook); g.add(p.g);
      const apex = P2(1.5, -2.2), legM = plain("#5b4127", 0.9);
      for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + 0.4, foot = P2(1.5, 0).add(new THREE.Vector3(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3)); stick(mesh(stickGeo(0.022), legM, g), foot, apex); }
      stick(mesh(stickGeo(0.006), plain(C.iron, 0.5, 0.7), g), apex, P2(1.5, -1.45));
      const pot = mesh(lathe("pot", [[0.001, 0], [0.13, 0.02], [0.18, 0.12], [0.17, 0.24], [0.15, 0.25], [0.001, 0.2]]), plain("#4f4a46", 0.55, 0.4), g); pot.position.copy(P2(1.5, -0.9));
      const ladle = mesh(stickGeo(0.012), plain("#7a5532", 0.8), g); return { p, ladle }; },
    frame(s, ph) {
      const sx = 1.45 + Math.cos(ph * TAU) * 0.15;
      s.p.setPose(pose(outfits.cook, { lean: 0.15, hip: [0.1, -1.85], backArm: { el: [0.55, -2.4], hand: [0.85, -2.15] }, frontArm: { el: [0.6, -2.35], hand: [sx - 0.25, -2.25] } }));
      stick(s.ladle, s.p.hands.front, P2(sx, -1.25, Math.sin(ph * TAU) * 0.05));
    } },
  // a groom holding a grazing horse
  horse: { period: 5, build(g) {
      const h = buildQuad(g, HORSE);
      const groom = new Person(outfits.groom); groom.g.position.set(0.75, 0, 1.25); groom.g.rotation.y = -Math.PI / 2 + 0.2; g.add(groom.g);
      const rope = mesh(stickGeo(0.008), plain("#6b4a2c", 0.9), g);
      return { h, groom, rope }; },
    frame(s, ph) {
      const gz = (1 - Math.cos(ph * TAU)) / 2, h = s.h, shift = Math.sin(ph * TAU) * 0.015;
      for (const L of h.legs) poseLeg(h, L, L.z + (L.hind ? -0.1 : 0.02) + shift, L.z + shift * 0.5);
      poseNeck(h, new THREE.Vector3(0, lerp(1.72, 0.55, gz), lerp(1.0, 1.08, gz)), lerp(0.85, 1.45, gz));
      h.tail.rotation.set(0.25 + Math.abs(Math.sin(ph * TAU * 3)) * 0.1, Math.sin(ph * TAU * 2) * 0.35, 0);
      s.groom.setPose(pose(outfits.groom, { frontArm: { el: [0.4, -2.3], hand: [0.75, -1.95 + gz * 0.25] } }));
      s.groom.g.updateMatrix(); const hand = s.groom.hands.front.clone().applyMatrix4(s.groom.g.matrix);
      h.head.updateMatrix(); const muzzle = new THREE.Vector3(0, -0.04, HORSE.head[0] * 0.92).applyMatrix4(h.head.matrix);
      stick(s.rope, hand, muzzle);
    } },
  // a dog trotting around the camp (the main loop moves it)
  dog: { period: 0.55, build(g) { return buildQuad(g, DOG); },
    frame(d, ph) {
      // trot: diagonal legs move together
      const off = { lf: 0, rh: 0, rf: 0.5, lh: 0.5 };
      for (const L of d.legs) { const q = Math.sin((ph + off[L.key]) * TAU), lift = Math.max(0, Math.cos((ph + off[L.key]) * TAU)) * 0.05; poseLeg(d, L, L.z + q * 0.04 + (L.hind ? -0.05 : 0.02), L.z + q * 0.08, lift); }
      poseNeck(d, new THREE.Vector3(0, 0.66 + Math.sin(ph * TAU * 2) * 0.01, 0.36), 0.35);
      d.tail.rotation.set(0, Math.sin(ph * TAU * 2) * 0.2, 0);
    } },
};

class Actor {
  constructor(key, opts = {}) {
    const def = ACTORS[key]; this.def = def; this.period = def.period; this.phase = opts.phase || 0; this.face = opts.face || null;
    this.mesh = new THREE.Group(); this.state = def.build(this.mesh, opts);
    def.frame(this.state, this.phase);
  }
  update(t) {
    const ph = (((t / this.period + this.phase) % 1) + 1) % 1;
    this.def.frame(this.state, ph);
    if (this.face) { const p = this.mesh.position; this.mesh.rotation.y = Math.atan2(this.face.x - p.x, this.face.z - p.z); }
  }
}

export { Actor, ACTORS, Person, outfits, pose, walkPose };
