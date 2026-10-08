import * as THREE from "three";
import { TAU, lerp, CUB } from "./util.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { pbr } from "./textures.js";

// People and animals as jointed 3D figures. Poses come from the proof of concept's side-view
// pose functions, in cubits with x forward and y up negative. Each figure maps them to its own
// local frame, where +z is forward, +y is up and +x is the figure's right side.

// ---------------- palette and outfits ----------------
// Colours follow docs/people-research.md: mostly undyed wool in natural browns and greys,
// woad blue and greens, with madder red kept for the most senior man.
const C = {
  skin: "#c98f6a", shieldY: 0xd7a531, oak: 0xa77a4c, iron: 0x4b4846, bronze: "#a8833f",
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
const UA = 0.6 * CUB, FA = 0.55 * CUB, TH = 0.9 * CUB, SH = 0.86 * CUB;

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

class Person {
  constructor(o) {
    this.o = o; this.g = new THREE.Group();
    const g = this.g, skin = skinMat(), hairM = plain(o.hair || C.hairBrown, 0.85);
    const body = o.dress ? wool(o.under) : wool(o.tunic), sleeve = body;
    const legM = wool(o.leg || C.undyedGrey), wrapM = wrapMat(o.wrap || "#5a4a3a");
    // torso, from the belt to the shoulders, flattened front to back
    this.torso = new THREE.Group(); g.add(this.torso);
    mesh(lathe("torso", [[0.001, 0], [0.155, 0], [0.17, 0.12], [0.168, 0.3], [0.195, 0.44], [0.16, 0.52], [0.07, 0.56], [0.001, 0.56]]), body, this.torso).scale.set(1.1, 1, 0.76);
    for (const sd of [1, -1]) mesh(ball(0.064), sleeve, this.torso).position.set(sd * 0.2, 0.47, 0); // shoulders
    this.skirt = new THREE.Group(); g.add(this.skirt);
    if (o.dress) {
      // linen shift to the ankles, wool apron dress from the armpits on two straps
      mesh(lathe("shift", [[0.15, 0.05], [0.18, -0.2], [0.21, -0.55], [0.22, -0.8]]), wool(o.under), this.skirt).scale.set(1, 1, 0.82);
      const apron = wool(o.tunic);
      mesh(lathe("apronTop", [[0.2, 0.43], [0.2, 0.2], [0.19, 0.0]]), apron, this.torso).scale.set(1.12, 1, 0.82);
      mesh(lathe("apronSkirt", [[0.215, 0.02], [0.235, -0.2], [0.26, -0.5], [0.265, -0.62]]), apron, this.skirt).scale.set(1.04, 1, 0.86);
      for (const sd of [1, -1]) {
        mesh(geo("strap", () => new THREE.TorusGeometry(0.13, 0.014, 4, 12, Math.PI).rotateY(Math.PI / 2).scale(1, 0.6, 1)), apron, this.torso).position.set(sd * 0.09, 0.43, 0);
        // paired oval brooches on the straps
        mesh(geo("brooch", () => new THREE.SphereGeometry(0.036, 14, 8, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(0.72, 1, 0.55)), plain(C.bronze, 0.35, 0.85), this.torso).position.set(sd * 0.092, 0.43, 0.165);
      }
      // a string of glass beads between the brooches
      for (let i = 0; i < 11; i++) { const t = i / 10; mesh(ball(0.0105), plain(["#b03a2e", "#2f6f9a", "#d9b44a", "#3e7a4a"][i % 4], 0.35), this.torso, false).position.set(lerp(-0.085, 0.085, t), 0.405 - Math.sin(t * Math.PI) * 0.075, 0.17 + Math.sin(t * Math.PI) * 0.008); }
      // shawl over the shoulders, closed with a third brooch
      mesh(geo("shawl", () => new THREE.SphereGeometry(0.235, 18, 8, Math.PI * 0.62, Math.PI * 1.76, Math.PI * 0.3, Math.PI * 0.2).scale(1, 1.1, 0.8)), wool(o.shawl), this.torso).position.y = 0.38;
      const third = new THREE.Group(); for (let k = 0; k < 3; k++) mesh(ball(0.016), plain(C.bronze, 0.35, 0.85), third, false).position.set(Math.cos((k / 3) * TAU) * 0.016, Math.sin((k / 3) * TAU) * 0.016, 0);
      third.position.set(0, 0.48, 0.16); this.torso.add(third);
    } else {
      // tunic skirt, flared by gores, to just above the knee
      mesh(lathe("skirt", [[0.165, 0.02], [0.19, -0.14], [0.235, -0.32], [0.26, -0.44]]), body, this.skirt).scale.set(1, 1, 0.82);
      mesh(geo("belt", () => new THREE.TorusGeometry(0.168, 0.016, 6, 22).rotateX(Math.PI / 2).scale(1, 1, 0.78)), leather(), this.skirt).position.y = 0.02;
      mesh(geo("buckle", () => new THREE.BoxGeometry(0.035, 0.032, 0.012)), plain(C.bronze, 0.35, 0.85), this.skirt).position.set(0, 0.02, 0.135);
      // knife in a leather sheath, hung from the belt
      const knife = new THREE.Group(); knife.position.set(-0.11, 0.0, 0.115); knife.rotation.set(0.1, 0.4, 0.5); this.skirt.add(knife);
      mesh(geo("sheath", () => new THREE.BoxGeometry(0.03, 0.17, 0.018).translate(0, -0.085, 0)), leather(), knife);
      mesh(geo("hilt", () => new THREE.CylinderGeometry(0.012, 0.013, 0.08, 8).translate(0, 0.04, 0)), plain("#8a6a46", 0.7), knife);
      if (o.trim) {
        const trim = plain(o.trim, 0.5, 0.2);
        mesh(geo("hemTrim", () => new THREE.TorusGeometry(0.262, 0.01, 4, 30).rotateX(Math.PI / 2).scale(1, 1, 0.82)), trim, this.skirt).position.y = -0.43;
        mesh(geo("neckTrim", () => new THREE.TorusGeometry(0.075, 0.01, 4, 20).rotateX(Math.PI / 2)), trim, this.torso).position.y = 0.55;
      }
    }
    if (o.cloak) {
      // rectangular wool cloak over the back and left shoulder, pinned at the right shoulder
      mesh(geo("cloak", () => new THREE.CylinderGeometry(0.23, 0.33, 0.78, 16, 1, true, Math.PI * 0.35, Math.PI * 1.25).translate(0, -0.3, 0).scale(1, 1, 0.82)), wool(o.cloak), this.torso).position.y = 0.55;
      mesh(geo("ringPin", () => new THREE.TorusGeometry(0.028, 0.006, 6, 16)), plain(C.bronze, 0.35, 0.85), this.torso).position.set(0.13, 0.5, 0.12);
    }
    // head with simple features
    this.head = new THREE.Group(); g.add(this.head);
    mesh(ball(0.1), skin, this.head).scale.set(0.86, 1.06, 0.97);
    mesh(ball(0.07), skin, this.head).position.set(0, -0.055, 0.025); // jaw
    mesh(geo("nose", () => new THREE.ConeGeometry(0.02, 0.05, 6).rotateX(Math.PI / 2 + 0.25)), skin, this.head).position.set(0, -0.012, 0.1);
    for (const sd of [1, -1]) {
      mesh(ball(0.022), skin, this.head).position.set(sd * 0.087, -0.005, -0.005);
      this.head.children.at(-1).scale.set(0.45, 1, 0.8);
      mesh(ball(0.0085), plain("#2a211b", 0.4), this.head, false).position.set(sd * 0.033, 0.016, 0.084);
      mesh(geo("brow", () => new THREE.BoxGeometry(0.036, 0.008, 0.012)), hairM, this.head, false).position.set(sd * 0.034, 0.035, 0.086);
    }
    mesh(geo("mouth", () => new THREE.BoxGeometry(0.032, 0.005, 0.006)), plain("#7a4a3e", 0.6), this.head, false).position.set(0, -0.05, 0.092);
    const style = o.hairStyle || "collar";
    mesh(geo("skull", () => new THREE.SphereGeometry(0.106, 16, 8, 0, TAU, 0, Math.PI * 0.36)), o.cap ? wool(o.cap) : hairM, this.head).position.set(0, 0.016, -0.004);
    if (style === "fringe") {
      // the "Danish fashion": long fringe in front, short at the nape
      mesh(geo("fringe", () => new THREE.SphereGeometry(0.11, 14, 6, Math.PI * 0.12, Math.PI * 0.76, Math.PI * 0.18, Math.PI * 0.2)), hairM, this.head).position.set(0, 0.012, 0.006);
      mesh(geo("hairBackShort", () => new THREE.SphereGeometry(0.108, 16, 8, Math.PI * 0.95, Math.PI * 1.1, 0, Math.PI * 0.5)), hairM, this.head).position.y = 0.012;
    } else if (style === "collar" || style === "knot") {
      mesh(geo("hairBackLong", () => new THREE.SphereGeometry(0.11, 16, 10, Math.PI * 0.85, Math.PI * 1.3, 0, Math.PI * 0.66)), hairM, this.head).position.y = 0.01;
      if (style === "collar") mesh(geo("hairNape", () => new THREE.CylinderGeometry(0.075, 0.085, 0.09, 12, 1, true, Math.PI * 0.75, Math.PI * 1.5)), hairM, this.head).position.set(0, -0.06, -0.012);
      else mesh(ball(0.045), hairM, this.head).position.set(0, -0.03, -0.11); // knot at the nape
    } else {
      mesh(geo("hairBackShort", () => new THREE.SphereGeometry(0.108, 16, 8, Math.PI * 0.95, Math.PI * 1.1, 0, Math.PI * 0.5)), hairM, this.head).position.y = 0.012;
    }
    if (o.cap) mesh(geo("cap", () => new THREE.SphereGeometry(0.113, 14, 8, 0, TAU, 0, Math.PI * 0.42).scale(1, 1.18, 1)), wool(o.cap), this.head).position.y = 0.02;
    if (o.beard === "full") mesh(geo("beard", () => new THREE.SphereGeometry(0.078, 14, 8, 0, TAU, Math.PI * 0.4, Math.PI * 0.6).scale(1, 1.2, 0.85)), hairM, this.head).position.set(0, -0.05, 0.035);
    if (o.beard === "full" || o.beard === "moustache") mesh(geo("moustache", () => new THREE.CapsuleGeometry(0.009, 0.05, 3, 6).rotateZ(Math.PI / 2)), hairM, this.head, false).position.set(0, -0.037, 0.094);
    if (o.beard === "moustache") mesh(ball(0.02), hairM, this.head, false).position.set(0, -0.085, 0.07);
    mesh(limb(0.042, 0.05, 0.1), skin, this.head).position.y = -0.07;
    // arms and legs, back side on the figure's left (-x), front side on its right (+x)
    this.limbs = {};
    for (const side of ["back", "front"]) {
      const L = {};
      L.ua = mesh(limb(0.062, 0.052, UA), sleeve, g); L.fa = mesh(limb(0.05, 0.036, FA), sleeve, g);
      L.el = mesh(ball(0.051), sleeve, g);
      if (o.trim) mesh(geo("cuff", () => new THREE.TorusGeometry(0.037, 0.008, 4, 14).rotateX(Math.PI / 2)), plain(o.trim, 0.5, 0.2), L.fa).position.y = -FA + 0.01;
      L.hand = new THREE.Group(); g.add(L.hand);
      mesh(geo("palm", () => new THREE.BoxGeometry(0.06, 0.08, 0.03, 2, 2, 1).translate(0, -0.035, 0)), skin, L.hand);
      mesh(geo("thumb", () => new THREE.CapsuleGeometry(0.012, 0.03, 3, 6).rotateZ(0.6).translate(0.035, -0.02, 0.012)), skin, L.hand);
      if (o.dress) { L.th = null; L.sh = null; L.kn = null; }
      else { L.th = mesh(limb(0.085, 0.066, TH), legM, g); L.kn = mesh(ball(0.064), wrapM, g); L.sh = mesh(limb(0.066, 0.05, SH), wrapM, g); }
      L.foot = mesh(shoeGeo(), leather(), g);
      this.limbs[side] = L;
    }
    this.hands = { back: new THREE.Vector3(), front: new THREE.Vector3() };
    this.mirror = 1;
  }
  // map a 2D pose point (cubits) to this figure's local frame
  v(p, lat = 0, out = new THREE.Vector3()) { return out.set(lat, -p[1] * CUB, this.mirror * p[0] * CUB); }
  setPose(pd) {
    const H = this.v(pd.hip), S = this.v(pd.sh);
    aim(this.torso, H, S, UP);
    this.skirt.position.copy(H); this.skirt.rotation.set(-pd.kick * this.mirror * 0.6, 0, 0);
    const hc = this.v([pd.sh[0] + 0.08 + pd.headX, pd.sh[1] - 0.42 + pd.headY]);
    this.head.position.copy(hc); this.head.rotation.set(0, this.mirror < 0 ? Math.PI : 0, 0);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (const [side, lat] of [["back", -0.205], ["front", 0.205]]) {
      const L = this.limbs[side], arm = pd[`${side}Arm`], leg = pd[`${side}Leg`];
      // arm: shoulder to elbow to hand, with fixed segment lengths
      a.copy(S).add(tq.set(lat, -0.04, 0));
      this.v(arm.el, lat, b); aim(L.ua, a, b); a.add(b.sub(a).normalize().multiplyScalar(UA)); L.el.position.copy(a);
      this.v(arm.hand, lat, b); aim(L.fa, a, b); const dir = b.sub(a).normalize(); a.addScaledVector(dir, FA);
      L.hand.position.copy(a); L.hand.quaternion.copy(L.fa.quaternion);
      this.hands[side].copy(a).addScaledVector(dir, 0.04);
      // leg: hip to knee to ankle, foot flat and pointing forward
      const ll = lat * 0.5;
      a.copy(H).add(tq.set(ll, 0, 0)); this.v(leg.knee, ll, b); this.v(leg.foot, ll, c); c.y += 0.07;
      if (L.th) { aim(L.th, a, b); a.add(b.sub(a).normalize().multiplyScalar(TH)); L.kn.position.copy(a); aim(L.sh, a, c); a.add(c.sub(a).normalize().multiplyScalar(SH)); }
      else a.copy(c);
      L.foot.position.set(a.x, Math.max(0, a.y - 0.07), a.z); L.foot.rotation.set(-(leg.toe || 0) * this.mirror, this.mirror < 0 ? Math.PI : 0, 0);
    }
  }
}

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
      const coat = plain("#7d5236", 0.75), dark = plain("#3b2a1e", 0.85), hoof = plain("#2a221c", 0.6);
      const h = { body: new THREE.Group(), legs: [], neck: mesh(limb(0.17, 0.1, 1), coat, g), mane: mesh(limb(0.045, 0.03, 1), dark, g), head: new THREE.Group(), tail: mesh(limb(0.07, 0.03, 0.7), dark, g) };
      g.add(h.body); h.body.position.set(0, 1.2, 0);
      // one smooth body from rump to chest, turned on a lathe along the horse's length
      mesh(geo("horseBody", () => new THREE.LatheGeometry([[0.001, -0.82], [0.17, -0.78], [0.28, -0.6], [0.31, -0.3], [0.33, 0], [0.32, 0.3], [0.29, 0.56], [0.2, 0.74], [0.001, 0.8]].map(([r, y]) => new THREE.Vector2(r, y)), 20).rotateX(Math.PI / 2).scale(0.82, 1, 1)), coat, h.body);
      for (const [z, lat, hind] of [[-0.52, -0.15, 1], [-0.42, 0.15, 1], [0.42, -0.15, 0], [0.52, 0.15, 0]]) { const up = mesh(limb(hind ? 0.12 : 0.1, 0.06, 0.55), coat, g), lo = mesh(limb(0.05, 0.042, 0.5), coat, g), hf = mesh(limb(0.05, 0.062, 0.08), hoof, g); h.legs.push({ z, lat, hind, up, lo, hf }); }
      mesh(geo("hhead", () => new THREE.CylinderGeometry(0.06, 0.11, 0.42, 12).rotateX(Math.PI / 2).translate(0, -0.02, 0.2)), coat, h.head);
      mesh(ball(0.105), coat, h.head).scale.set(0.9, 1.05, 1); // jowl
      mesh(ball(0.065), coat, h.head).position.set(0, -0.04, 0.4); // muzzle
      for (const sd of [1, -1]) mesh(ball(0.012), plain("#1d1612", 0.3), h.head, false).position.set(sd * 0.075, 0.03, 0.06);
      for (const sd of [1, -1]) mesh(geo("ear", () => new THREE.ConeGeometry(0.03, 0.1, 6)), coat, h.head).position.set(sd * 0.06, 0.1, -0.04);
      g.add(h.head);
      const groom = new Person(outfits.groom); groom.g.position.set(0.75, 0, 1.15); groom.g.rotation.y = -Math.PI / 2 + 0.2; g.add(groom.g);
      const rope = mesh(stickGeo(0.008), plain("#6b4a2c", 0.9), g);
      return { h, groom, rope }; },
    frame(s, ph) {
      const gz = (1 - Math.cos(ph * TAU)) / 2, tail = Math.sin(ph * TAU * 2) * 0.15, h = s.h;
      for (const L of h.legs) { const top = new THREE.Vector3(L.lat, 1.12, L.z), knee = new THREE.Vector3(L.lat, 0.56, L.z + (L.hind ? -0.12 : 0.03)), foot = new THREE.Vector3(L.lat, 0.08, L.z); aim(L.up, top, knee); aim(L.lo, knee, foot); L.hf.position.copy(foot); }
      const withers = new THREE.Vector3(0, 1.36, 0.5), poll = new THREE.Vector3(0, lerp(1.78, 0.5, gz), lerp(0.98, 1.05, gz));
      s.h.neck.scale.set(1, withers.distanceTo(poll), 1); aim(s.h.neck, withers, poll); s.h.mane.scale.set(1, withers.distanceTo(poll), 1); aim(s.h.mane, withers.clone().add(new THREE.Vector3(0, 0.08, -0.03)), poll.clone().add(new THREE.Vector3(0, 0.08, -0.03)));
      h.head.position.copy(poll); h.head.rotation.set(lerp(0.75, 1.35, gz), 0, 0);
      aim(h.tail, new THREE.Vector3(0, 1.3, -0.78), new THREE.Vector3(tail * 0.6, 0.62, -0.92 + Math.abs(tail) * 0.2));
      s.groom.setPose(pose(outfits.groom, { frontArm: { el: [0.4, -2.3], hand: [0.75, -1.95 + gz * 0.25] } }));
      s.groom.g.updateMatrix(); const hand = s.groom.hands.front.clone().applyMatrix4(s.groom.g.matrix);
      h.head.updateMatrix(); const muzzle = new THREE.Vector3(0, -0.02, 0.4).applyMatrix4(h.head.matrix);
      stick(s.rope, hand, muzzle);
    } },
  // a dog trotting around the camp (the main loop moves it)
  dog: { period: 0.55, build(g) {
      const fur = plain("#9b7a52", 0.85), dark = plain("#6e5538", 0.85);
      const d = { body: mesh(ball(1), fur, g), head: mesh(ball(1), fur, g), snout: mesh(limb(0.035, 0.028, 0.12), fur, g), tail: mesh(limb(0.025, 0.012, 0.22), dark, g), legs: [] };
      d.body.scale.set(0.14, 0.15, 0.32); d.body.position.set(0, 0.42, 0);
      d.head.scale.set(0.1, 0.1, 0.115); d.head.position.set(0, 0.56, 0.34); d.snout.position.set(0, 0.53, 0.4); d.snout.rotation.x = -Math.PI / 2;
      for (const sd of [1, -1]) mesh(geo("dogear", () => new THREE.ConeGeometry(0.03, 0.08, 5)), dark, g).position.set(sd * 0.045, 0.64, 0.3);
      for (const [z, lat, off] of [[-0.2, -0.07, 0], [-0.2, 0.07, 0.5], [0.2, -0.07, 0.25], [0.2, 0.07, 0.75]]) d.legs.push({ z, lat, off, up: mesh(limb(0.042, 0.032, 0.2), fur, g), lo: mesh(limb(0.03, 0.026, 0.2), fur, g) });
      return d; },
    frame(d, ph) {
      for (const L of d.legs) { const q = Math.sin((ph + L.off) * TAU), top = new THREE.Vector3(L.lat, 0.38, L.z), knee = new THREE.Vector3(L.lat, 0.2, L.z + q * 0.05), foot = new THREE.Vector3(L.lat, 0.02 + Math.max(0, q) * 0.04, L.z + q * 0.09); aim(L.up, top, knee); aim(L.lo, knee, foot); }
      aim(d.tail, new THREE.Vector3(0, 0.46, -0.28), new THREE.Vector3(Math.sin(ph * TAU * 2) * 0.08, 0.6, -0.42));
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
