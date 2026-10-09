import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { CUB } from "./util.js";
import { pbr } from "./textures.js";
import manifest from "./people-manifest.json";

// Realistic people. The bodies, faces, eyes, hair and beards are CC0 MakeHuman assets,
// assembled in Blender with MPFB by scripts/humans/. The Viking clothing is built there from
// each body's own surface, so it moves with the skin. Here the figures are loaded, given
// materials, and posed every frame from the proof of concept's side-view pose data.

const base = import.meta.env.BASE_URL + "assets/people/";
const bodies = new Map(), textures = new Map();

function preloadPeople(manager) {
  const loader = new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder);
  const tl = new THREE.TextureLoader(manager);
  for (const [name, file] of Object.entries(manifest.bodies)) loader.load(base + file, (g) => bodies.set(name, g.scene));
  for (const [key, file] of Object.entries(manifest.textures)) {
    const t = tl.load(base + file);
    t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    textures.set(key, t);
  }
}

// ---------------- materials ----------------
const mats = new Map();
const mat = (key, make) => { if (!mats.has(key)) mats.set(key, make()); return mats.get(key); };
const tex = (key) => { const t = textures.get(key); if (!t) throw new Error(`Missing people texture ${key}`); return t; };
const clothMaps = new Map();
function cloth(role, repeat) {
  const key = `${role}${repeat}`;
  if (!clothMaps.has(key)) { const m = pbr(role, { repeat: [repeat, repeat] }); clothMaps.set(key, m); }
  return clothMaps.get(key);
}
// Wool and linen take their colour from the palette and their weave from the photo-scanned maps.
const fabric = (role, hex, repeat = 2.5) => mat(`f${role}${hex}`, () => {
  const m = cloth(role, repeat);
  return new THREE.MeshPhysicalMaterial({ color: hex, normalMap: m.normalMap, roughnessMap: m.roughnessMap, roughness: 1, sheen: role === "linen" ? 0.2 : 0.45, sheenRoughness: 0.8, sheenColor: new THREE.Color(hex).lerp(new THREE.Color("#ffffff"), 0.1), side: THREE.DoubleSide });
});
const leather = () => mat("leather", () => { const m = cloth("leather", 3); return new THREE.MeshStandardMaterial({ map: m.map, color: "#9a8070", normalMap: m.normalMap, roughnessMap: m.roughnessMap, roughness: 1 }); });
const skin = (key) => mat(`skin${key}`, () => new THREE.MeshPhysicalMaterial({ map: tex(`skin_${key}`), roughness: 0.55, sheen: 0.3, sheenRoughness: 0.5, sheenColor: new THREE.Color("#f0c0a8") }));
const eyes = (key) => mat(`eye${key}`, () => new THREE.MeshPhysicalMaterial({ map: tex(`eye_${key}`), roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.1 }));
// Hair textures are stored as grey strands, so one texture can take any hair colour.
const strands = (key, hex, cut = 0.5) => mat(`s${key}${hex}`, () => new THREE.MeshStandardMaterial({ map: tex(key), color: hex, alphaTest: cut, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.6 }));

// ---------------- metal fittings ----------------
// Hung on anchor nodes that the Blender script places on the bones (see make_human.py).
const bronze = () => mat("bronze", () => new THREE.MeshStandardMaterial({ color: "#a8833f", roughness: 0.35, metalness: 0.85 }));
const geos = new Map();
const geo = (key, make) => { if (!geos.has(key)) geos.set(key, make()); return geos.get(key); };
const part = (g, m, parent) => { const o = new THREE.Mesh(g, m); o.castShadow = false; o.receiveShadow = true; parent.add(o); return o; };
const beadCols = ["#b03a2e", "#2f6f9a", "#d9b44a", "#3e7a4a"];
function fittings(model, o) {
  const at = (n) => model.getObjectByName(n);
  // oval brooches, a matching pair, with a string of glass beads between them
  for (const s of ["l", "r"]) { const a = at(`anchor_brooch_${s}`); if (a) part(geo("brooch", () => new THREE.SphereGeometry(0.036, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(0.72, 1, 0.5)), bronze(), a); }
  const beads = at("anchor_beads");
  if (beads) for (let i = 0; i < 13; i++) {
    const t = i / 12, b = part(geo("bead", () => new THREE.SphereGeometry(0.0095, 8, 6)), mat(`bead${i % 4}`, () => new THREE.MeshStandardMaterial({ color: beadCols[i % 4], roughness: 0.25 })), beads);
    b.position.set((t - 0.5) * 0.17, 0.05 - Math.sin(t * Math.PI) * 0.07, 0.004 + Math.sin(t * Math.PI) * 0.012);
  }
  const shawl = at("anchor_shawlpin");
  if (shawl) part(geo("disc", () => new THREE.CylinderGeometry(0.026, 0.028, 0.01, 18).rotateX(Math.PI / 2)), bronze(), shawl);
  // belt buckle and a knife in a leather sheath
  const buckle = at("anchor_buckle");
  if (buckle) part(geo("buckle", () => new THREE.TorusGeometry(0.016, 0.004, 4, 10).scale(1, 1.15, 0.6)), bronze(), buckle);
  const knife = at("anchor_knife");
  if (knife) {
    const k = new THREE.Group(); k.rotation.set(0.05, 0.5, 0.45); knife.add(k);
    part(geo("sheath", () => new THREE.BoxGeometry(0.032, 0.18, 0.016).translate(0, -0.09, 0)), leather(), k);
    part(geo("hilt", () => new THREE.CylinderGeometry(0.011, 0.013, 0.08, 8).translate(0, 0.04, 0)), mat("hilt", () => new THREE.MeshStandardMaterial({ color: "#8a6a46", roughness: 0.7 })), k);
  }
  // tablet-woven trim at the cuffs and neckline, for the better-dressed men
  if (o.trim) {
    const band = mat(`trim${o.trim}`, () => new THREE.MeshStandardMaterial({ color: o.trim, roughness: 0.5, metalness: 0.25 }));
    for (const s of ["l", "r"]) { const a = at(`anchor_cuff_${s}`); if (a) part(geo("cuff", () => new THREE.TorusGeometry(0.047, 0.007, 4, 18).rotateX(Math.PI / 2)), band, a); }
    const n = at("anchor_neck"); if (n) part(geo("neckband", () => new THREE.TorusGeometry(0.085, 0.008, 4, 24).rotateX(Math.PI / 2).scale(1, 1, 0.92)), band, n);
  }
  // the cloak is held at the right shoulder by a ringed pin
  const pin = at("anchor_cloakpin");
  if (pin) {
    part(geo("ring", () => new THREE.TorusGeometry(0.026, 0.005, 6, 18)), bronze(), pin);
    part(geo("pin", () => new THREE.CylinderGeometry(0.003, 0.003, 0.13, 6).rotateZ(0.3)), bronze(), pin).position.y = -0.03;
  }
}

// ---------------- pose mapping ----------------
// The pose data comes from the proof of concept: points in cubits, x forward, y up negative,
// for a figure with these proportions. Each figure scales it to its own body.
const UA = 0.6 * CUB, FA = 0.55 * CUB, TH = 0.9 * CUB, SH = 0.86 * CUB, HIP_Y = 1.85 * CUB;
const ARM_POSE = UA + FA;
const v = new THREE.Vector3(), w = new THREE.Vector3(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion();
const ID = new THREE.Quaternion();

// rotate a bone by a world-space rotation, keeping its children attached
function turnWorld(bone, rot) {
  bone.parent.getWorldQuaternion(q2);
  const local = q2.clone().invert().multiply(rot).multiply(q2);
  bone.quaternion.premultiply(local);
  bone.updateMatrixWorld(true);
}
// turn a bone so the direction to `child` points at `target` (world space)
function aimAt(bone, child, target) {
  const p = bone.getWorldPosition(new THREE.Vector3()), c = child.getWorldPosition(new THREE.Vector3());
  const from = c.sub(p).normalize(), to = target.clone().sub(p).normalize();
  if (to.lengthSq() < 1e-8) return;
  turnWorld(bone, new THREE.Quaternion().setFromUnitVectors(from, to));
}
// two-bone reach: the joint position for a chain from a to target, bending toward pole
function solveJoint(a, target, l1, l2, pole) {
  const d = target.clone().sub(a), len = THREE.MathUtils.clamp(d.length(), Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4);
  d.normalize();
  const cosA = (l1 * l1 + len * len - l2 * l2) / (2 * l1 * len), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const n = pole.clone().sub(a); n.addScaledVector(d, -n.dot(d));
  if (n.lengthSq() < 1e-8) n.set(0, 0, 1).addScaledVector(d, -d.z);
  n.normalize();
  return a.clone().addScaledVector(d, l1 * cosA).addScaledVector(n, l1 * sinA);
}

class Human {
  constructor(o) {
    const src = bodies.get(o.body);
    if (!src) throw new Error(`Body ${o.body} was not preloaded`);
    this.o = o; this.g = new THREE.Group();
    this.model = cloneSkinned(src); this.g.add(this.model);
    this.g.userData.isHuman = true;
    const info = JSON.parse(this.model.getObjectByName("rig")?.userData?.mh || "{}");
    // materials by part name
    const looks = {
      body: () => skin(info.skin || "m"), eyes: () => eyes(o.eyes || "brown"),
      brows: () => strands("brow", o.hair, 0.3), lashes: () => strands("lash", "#2a2018", 0.3),
      hair: () => strands(`hair_${info.hair}`, o.hair), beard: () => strands(`beard_${info.beard}`, o.beardColour || o.hair, 0.3),
      tunic: () => fabric("wool", o.tunic), trousers: () => fabric("wool", o.leg || "#8a857a"), wraps: () => fabric("twill", o.wrap || "#5a4a3a", 4),
      leather, cap: () => fabric("wool", o.cap || "#5c4c3e"), cloak: () => fabric("wool", o.cloak || "#3c4f68"),
      underdress: () => fabric("linen", o.under || "#cfc4ad", 3), apron: () => fabric("wool", o.tunic), shawl: () => fabric("wool", o.shawl || "#7a5f48"),
    };
    const casts = new Set(["body", "tunic", "underdress", "apron", "trousers", "cloak", "shawl", "hair"]);
    this.model.traverse((m) => {
      if (!m.isMesh) return;
      const part = m.name.replace(/_\d+$/, "");
      const look = looks[part]; if (look) m.material = look();
      m.castShadow = casts.has(part); m.receiveShadow = true;
      m.frustumCulled = false; // skinned bounds do not follow the pose
    });
    fittings(this.model, o);
    this.b = {};
    this.model.traverse((n) => { if (n.isBone) this.b[n.name] = n; });
    this.model.updateMatrixWorld(true);
    this.rest = new Map();
    for (const n of Object.values(this.b)) this.rest.set(n, { q: n.quaternion.clone(), p: n.position.clone() });
    const wp = (n) => this.b[n].getWorldPosition(new THREE.Vector3());
    this.hipY = wp("pelvis").y;
    this.k = this.hipY / HIP_Y;
    this.arm = { l1: wp("upperarm_l").distanceTo(wp("lowerarm_l")), l2: wp("lowerarm_l").distanceTo(wp("hand_l")) };
    this.leg = { l1: wp("thigh_l").distanceTo(wp("calf_l")), l2: wp("calf_l").distanceTo(wp("foot_l")) };
    this.armScale = (this.arm.l1 + this.arm.l2) / ARM_POSE;
    this.shoulderY = wp("upperarm_l").y + 0.075; // top of the shoulder, where a carried oar rests
    this.grip();
    this.footRest = {};
    for (const s of ["l", "r"]) this.footRest[s] = this.b[`foot_${s}`].getWorldQuaternion(new THREE.Quaternion());
    this.hands = { back: new THREE.Vector3(), front: new THREE.Vector3() };
    this.mirror = 1;
  }
  // Curl the fingers into a loose grip. Most figures hold a tool, and open A-pose hands look odd.
  // The finger bones sit under the hand bone, so the reach of the arm does not change this.
  grip() {
    const wp = (n) => this.b[n].getWorldPosition(new THREE.Vector3());
    for (const s of ["l", "r"]) {
      if (!this.b[`index_01_${s}`]) continue;
      const across = wp(`pinky_01_${s}`).sub(wp(`index_01_${s}`)).normalize();
      const thumbTip = wp(`thumb_03_${s}`);
      // find which way round the knuckle axis closes the hand: the tip should come toward the thumb
      const test = (sign) => {
        const b = this.b[`index_01_${s}`], keep = b.quaternion.clone();
        turnWorld(b, new THREE.Quaternion().setFromAxisAngle(across, sign * 1.0));
        const d = wp(`index_03_${s}`).distanceTo(thumbTip);
        b.quaternion.copy(keep); b.updateMatrixWorld(true); return d;
      };
      const sign = test(1) < test(-1) ? 1 : -1;
      for (const f of ["index", "middle", "ring", "pinky"]) {
        [0.75, 0.95, 0.7].forEach((a, j) => turnWorld(this.b[`${f}_0${j + 1}_${s}`], new THREE.Quaternion().setFromAxisAngle(across, sign * a * (f === "index" ? 0.85 : 1))));
      }
      for (const n of [`thumb_02_${s}`, `thumb_03_${s}`]) turnWorld(this.b[n], new THREE.Quaternion().setFromAxisAngle(across, sign * 0.35));
    }
    for (const n of Object.values(this.b)) if (/^(index|middle|ring|pinky|thumb)/.test(n.name)) this.rest.get(n).q.copy(n.quaternion);
  }
  // a pose point in cubits to this figure's local frame, scaled to its body
  v(p, lat = 0, out = new THREE.Vector3()) { return out.set(lat, -p[1] * CUB * this.k, this.mirror * p[0] * CUB * this.k); }
  setPose(pd) {
    const b = this.b, g = this.g;
    for (const [n, r] of this.rest) { n.quaternion.copy(r.q); n.position.copy(r.p); }
    g.updateWorldMatrix(true, false);
    this.model.updateMatrixWorld(true);
    const gq = g.getWorldQuaternion(new THREE.Quaternion());
    const toWorld = (p) => g.localToWorld(p.clone());
    const dirWorld = (d) => d.clone().applyQuaternion(gq);

    // hips: place the pelvis, then tip it with the stride
    const H = toWorld(this.v(pd.hip));
    b.pelvis.position.copy(b.pelvis.parent.worldToLocal(H.clone()));
    b.pelvis.updateMatrixWorld(true);
    turnWorld(b.pelvis, q.setFromAxisAngle(dirWorld(v.set(1, 0, 0)), -pd.kick * 0.6));

    // spine: bend toward the shoulder point, spread over three bones
    const S = toWorld(this.v(pd.sh));
    const now = b.neck_01.getWorldPosition(new THREE.Vector3()).sub(b.spine_01.getWorldPosition(new THREE.Vector3())).normalize();
    const want = S.clone().sub(H).normalize();
    const bend = new THREE.Quaternion().setFromUnitVectors(now, want), part = ID.clone().slerp(bend, 1 / 3);
    for (const n of ["spine_01", "spine_02", "spine_03"]) turnWorld(b[n], part);
    // keep the head nearer upright, with a small nod from the pose
    turnWorld(b.neck_01, ID.clone().slerp(bend.clone().invert(), 0.45));
    turnWorld(b.head, q.setFromAxisAngle(dirWorld(v.set(1, 0, 0)), (pd.headY || 0) * 4 + (pd.headX || 0) * -2));

    // arms: rebuild the proof of concept's elbow and wrist, then reach with this body's arm lengths
    for (const [side, s, lat] of [["back", "r", -0.205], ["front", "l", 0.205]]) {
      const arm = pd[`${side}Arm`];
      const sh0 = this.v(pd.sh, lat).add(v.set(0, -0.04 * this.k, 0));
      const el0 = this.v(arm.el, lat), hd0 = this.v(arm.hand, lat);
      const elbow = sh0.clone().add(el0.sub(sh0).normalize().multiplyScalar(UA * this.k));
      const wrist = elbow.clone().add(hd0.sub(elbow).normalize().multiplyScalar(FA * this.k));
      const ua = b[`upperarm_${s}`], fa = b[`lowerarm_${s}`], hand = b[`hand_${s}`];
      const A = ua.getWorldPosition(new THREE.Vector3());
      const sc = this.armScale / this.k;
      const T = A.clone().add(dirWorld(wrist.clone().sub(sh0).multiplyScalar(sc)));
      const P = A.clone().add(dirWorld(elbow.clone().sub(sh0).multiplyScalar(sc)));
      const E = solveJoint(A, T, this.arm.l1, this.arm.l2, P);
      aimAt(ua, fa, E); aimAt(fa, hand, T);
      const end = hand.getWorldPosition(new THREE.Vector3()), dir = end.clone().sub(fa.getWorldPosition(w)).normalize();
      g.worldToLocal(this.hands[side].copy(end).addScaledVector(dir, 0.07));
    }

    // legs: feet go where the pose puts them, knees bend toward the pose's knees
    for (const [side, s, lat] of [["back", "r", -0.1025], ["front", "l", 0.1025]]) {
      const leg = pd[`${side}Leg`], ll = lat * 0.5;
      const hip0 = this.v(pd.hip, ll), kn0 = this.v(leg.knee, ll), ft0 = this.v(leg.foot, ll); ft0.y += 0.07 * this.k;
      const knee = hip0.clone().add(kn0.sub(hip0).normalize().multiplyScalar(TH * this.k));
      let ankle = knee.clone().add(ft0.clone().sub(knee).normalize().multiplyScalar(SH * this.k));
      if (this.o.dress) ankle = ft0;
      const th = b[`thigh_${s}`], cf = b[`calf_${s}`], ft = b[`foot_${s}`];
      const A = th.getWorldPosition(new THREE.Vector3());
      const T = toWorld(ankle), P = toWorld(knee.clone().add(v.set(0, 0, 0.3)));
      const E = solveJoint(A, T, this.leg.l1, this.leg.l2, P);
      aimAt(th, cf, E); aimAt(cf, ft, T);
      // the foot stays level with the ground and points forward, tipping only with the toe-off
      const flat = gq.clone().multiply(this.footRest[s]);
      const tip = q.setFromAxisAngle(dirWorld(v.set(1, 0, 0)), -(leg.toe || 0));
      const target = tip.clone().multiply(flat);
      ft.parent.getWorldQuaternion(q2);
      ft.quaternion.copy(q2.invert().multiply(target));
      ft.updateMatrixWorld(true);
    }
  }
}

export { preloadPeople, Human };
