import * as THREE from "three";
import { Water } from "three/addons/objects/Water.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { TAU, clamp, rngFrom } from "./util.js";
import { TIER, renderer, scene, camera, sun, add } from "./core.js";
import { SHIP, H, woodMat, std } from "./ship.js";
import { pbr, file, skyBackdrop, skyLight, sunDirection } from "./textures.js";

const SEA_Y = -0.25, SHORE_Z = -16; // the beach sits about 0.3 m above the water

// ---------------- sky, sky light and sun ----------------
const sunDir = sunDirection();
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(skyLight()).texture;
  scene.environmentIntensity = 0.9;
  pmrem.dispose();
  sun.position.copy(sunDir).multiplyScalar(60);
}
// The visible sky is a sphere that follows the camera and samples the sky photo
// with the same equirectangular mapping three.js uses for the light, so they line up.
const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), new THREE.ShaderMaterial({
  uniforms: { map: { value: skyBackdrop() } },
  vertexShader: "varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `uniform sampler2D map; varying vec3 vDir;
    void main() {
      vec3 d = normalize(vDir);
      vec2 uv = vec2(atan(d.z, d.x) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5);
      gl_FragColor = texture2D(map, uv);
      #include <colorspace_fragment>
    }`,
  side: THREE.BackSide, depthWrite: false, toneMapped: false,
}));
sky.renderOrder = -10; sky.frustumCulled = false;
scene.add(sky);

// Haze toward the horizon, matched to the sky just above it.
function horizonColor() {
  const img = skyBackdrop().image, c = document.createElement("canvas"); c.width = 64; c.height = 32;
  const x = c.getContext("2d"); x.drawImage(img, 0, 0, 64, 32);
  const d = x.getImageData(0, 14, 64, 1).data; let r = 0, g = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
  const n = d.length / 4; return new THREE.Color().setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace);
}
scene.fog = new THREE.Fog(horizonColor(), 120, 1400);

// ---------------- beach and land ----------------
// Height of the ground. Flat under the ship and camp, sloping into the sea past the shoreline.
function shoreZ(x) { return SHORE_Z + 3.2 * Math.sin(x * 0.018 + 1.3) * Math.min(1, Math.abs(x) / 25) + 0.9 * Math.sin(x * 0.07) + 0.35 * Math.sin(x * 0.23 + 2); }
function groundY(x, z) {
  const R = 0.08 * (Math.sin(x * 0.21 + z * 0.13) * Math.sin(z * 0.17 - x * 0.07)) + 0.03 * Math.sin(x * 0.9) * Math.sin(z * 0.8);
  const nearShip = Math.max(0, 1 - Math.max(Math.abs(x) / 14, Math.abs(z) / 16));
  const awayFromSea = THREE.MathUtils.smoothstep(z, SHORE_Z + 1, SHORE_Z + 7);
  const toSea = z - shoreZ(x); // meters inland from the waterline
  const beach = toSea < 4 ? (toSea - 4) * 0.073 : 0; // the beach slopes under the water at the waterline
  const inland = Math.max(0, z - 28);
  const rise = inland > 0 ? Math.min(9, inland * 0.06) + Math.max(0, Math.sin(x * 0.021 + 0.7) * Math.sin(z * 0.017)) * inland * 0.08 : 0;
  return 0.042 + R * (1 - nearShip) * awayFromSea + beach + rise;
}
const ground = (() => {
  // lighter terrain on Low
  const g = new THREE.PlaneGeometry(1400, 520, TIER.water ? 420 : 240, TIER.water ? 220 : 130);
  g.rotateX(-Math.PI / 2); g.translate(0, 0, 200);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, groundY(p.getX(i), p.getZ(i)));
  g.computeVertexNormals();
  const T = 3.0; // meters per sand tile
  const sand = pbr("sand"), wet = pbr("wetsand"), grass = pbr("grass");
  const mat = std({ ...sand, color: 0xfff4e6 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.wetMap = { value: wet.map }; sh.uniforms.grassMap = { value: grass.map }; sh.uniforms.wetArm = { value: wet.roughnessMap }; sh.uniforms.grassArm = { value: grass.roughnessMap };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWorld;").replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
        varying vec3 vWorld; uniform sampler2D wetMap, grassMap, wetArm, grassArm;
        float hsh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hsh(i), hsh(i + vec2(1, 0)), f.x), mix(hsh(i + vec2(0, 1)), hsh(i + vec2(1, 1)), f.x), f.y); }
        float wetW() { return 1.0 - smoothstep(${SEA_Y.toFixed(3)} + 0.04, ${SEA_Y.toFixed(3)} + 0.22, vWorld.y + (vnoise(vWorld.xz * 0.15) - 0.5) * 0.08); }
        float grassW() { return smoothstep(15.0, 19.0, vWorld.z + (vnoise(vWorld.xz * 0.12) - 0.5) * 7.0 + (vnoise(vWorld.xz * 0.6) - 0.5) * 1.5); }`)
      .replace("#include <map_fragment>", `#include <map_fragment>
        vec2 wuv = vWorld.xz / ${T.toFixed(1)};
        diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(wetMap, wuv * 0.9).rgb * 0.62, wetW());
        diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(grassMap, wuv * 0.8).rgb * vec3(0.6, 0.72, 0.45), grassW());`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, texture2D(wetArm, vWorld.xz / ${T.toFixed(1)} * 0.9).g * 0.35, wetW());
        roughnessFactor = mix(roughnessFactor, texture2D(grassArm, vWorld.xz / ${T.toFixed(1)} * 0.8).g, grassW());`);
  };
  // the material samples by world position, so the plane's own UVs repeat at the same scale
  for (const t of [mat.map, mat.normalMap, mat.roughnessMap]) t.repeat.set(1400 / T, 520 / T);
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true; scene.add(m);
  return m;
})();
const grass = ground;

// rollers under the keel
{
  const rollers = [];
  for (const u of [-0.55, -0.15, 0.25, 0.6]) rollers.push(new THREE.CylinderGeometry(0.2, 0.2, 2.4, 14).rotateZ(Math.PI / 2).translate(0, 0.2 + H.keelY(u) * 0.5, u * SHIP.Lh));
  add(new THREE.Mesh(mergeGeometries(rollers), woodMat));
}

// ---------------- sea ----------------
// Medium and High use the reflecting ocean shader. Low uses a cheaper glossy surface that
// reflects the sky light and scrolls its ripples, without rendering the scene a second time.
const water = TIER.water ? (() => {
  const w = new Water(new THREE.PlaneGeometry(6000, 3000), {
    textureWidth: TIER.water, textureHeight: TIER.water,
    waterNormals: file("tex/waternormals.jpg", { repeat: [1, 1] }),
    sunDirection: sunDir.clone(), sunColor: 0xfff3e0, waterColor: 0x0a2f3c,
    distortionScale: 2.2, fog: true, alpha: 1.0,
  });
  w.material.uniforms.size.value = 6;
  // Water reflects about 4 percent of light head-on. The addon uses 30 percent, which turns the sea grey.
  w.material.fragmentShader = w.material.fragmentShader.replace("float rf0 = 0.3;", "float rf0 = 0.04;").replace("reflectionSample * 0.9", "reflectionSample * 0.48");
  return w;
})() : new THREE.Mesh(new THREE.PlaneGeometry(6000, 3000), new THREE.MeshStandardMaterial({ color: 0x174652, roughness: 0.08, metalness: 0, normalMap: file("tex/waternormals.jpg", { repeat: [300, 150] }), normalScale: new THREE.Vector2(0.35, 0.35) }));
water.rotation.x = -Math.PI / 2; water.position.set(0, SEA_Y, SHORE_Z + 3 - 1500); // ends just under the beach
scene.add(water);

// foam along the waterline, a strip that follows the shore and drifts in and out
const foamTex = (() => {
  const c = document.createElement("canvas"); c.width = 512; c.height = 64; const x = c.getContext("2d"), R = rngFrom(612);
  for (let i = 0; i < 900; i++) { const px = R() * 512, py = 18 + R() * 30, r = 1 + R() * 5; x.fillStyle = `rgba(255,255,255,${0.12 + R() * 0.35})`; x.beginPath(); x.ellipse(px, py, r * 2.2, r, 0, 0, TAU); x.fill(); }
  const fade = x.createLinearGradient(0, 0, 0, 64); fade.addColorStop(0, "rgba(0,0,0,1)"); fade.addColorStop(0.35, "rgba(0,0,0,0)"); fade.addColorStop(0.8, "rgba(0,0,0,0)"); fade.addColorStop(1, "rgba(0,0,0,1)");
  x.globalCompositeOperation = "destination-out"; x.fillStyle = fade; x.fillRect(0, 0, 512, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(60, 1); return t;
})();
const foam = (() => {
  const n = 600, pos = [], uv = [], idx = [];
  for (let i = 0; i <= n; i++) { const x = -300 + (600 * i) / n, z = shoreZ(x); pos.push(x, SEA_Y + 0.012, z - 1.6, x, SEA_Y + 0.012, z + 0.9); uv.push(i / n, 0, i / n, 1); }
  for (let i = 0; i < n; i++) { const q = i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: foamTex, transparent: true, depthWrite: false, roughness: 0.9, side: THREE.DoubleSide }));
  m.renderOrder = 1; scene.add(m); return m;
})();

// ---------------- woods inland ----------------
// simple instanced trees on the rising ground behind the beach, mostly seen from a distance
{
  const R = rngFrom(655), crown = mergeGeometries([0, 1, 2].map((k) => new THREE.ConeGeometry(0.9 - k * 0.25, 0.75, 9).translate(0, -0.55 + k * 0.42, 0))), trunk = new THREE.CylinderGeometry(0.12, 0.18, 1, 6).translate(0, 0.5, 0);
  const N = 1400, crowns = new THREE.InstancedMesh(crown, std({ color: 0xffffff, roughness: 0.95 }), N), trunks = new THREE.InstancedMesh(trunk, std({ color: 0x4a3a2c, roughness: 1 }), N);
  const o = new THREE.Object3D(), c = new THREE.Color(); let n = 0;
  for (let i = 0; i < 6000 && n < N; i++) {
    const x = (R() - 0.5) * 900, z = 80 + R() * 340;
    const dens = 0.5 + 0.5 * Math.sin(x * 0.013 + 1) * Math.sin(z * 0.02); if (R() > dens || (Math.abs(x + 14) < 18 && z < 60)) continue;
    const y = groundY(x, z), h = 10 + R() * 9, w = h * (0.2 + R() * 0.07);
    o.position.set(x, y, z); o.rotation.set(0, R() * 6, 0); o.scale.set(1, h * 0.4, 1); o.updateMatrix(); trunks.setMatrixAt(n, o.matrix);
    o.position.set(x, y + h * 0.62, z); o.scale.set(w, h * 0.6, w); o.updateMatrix(); crowns.setMatrixAt(n, o.matrix);
    crowns.setColorAt(n, c.setHSL(0.27 + R() * 0.06, 0.25 + R() * 0.15, 0.08 + R() * 0.05)); n++;
  }
  crowns.count = trunks.count = n;
  crowns.castShadow = false; crowns.receiveShadow = false; trunks.castShadow = false;
  scene.add(crowns, trunks);
}

// ---------------- wooded hills across the water ----------------
{
  const mat = std({ ...pbr("rock", { repeat: [1, 1] }), vertexColors: true });
  for (const t of [mat.map, mat.normalMap, mat.roughnessMap]) t.repeat.set(60, 14);
  const fbm = (R) => { const ph = Array.from({ length: 12 }, () => R() * 100); return (x, z) => { let v = 0, a = 1, f = 1, n = 0; for (let o = 0; o < 6; o++) { v += a * Math.sin(x * 0.004 * f + ph[o]) * Math.sin(z * 0.006 * f + ph[o + 6]) ; n += a; a *= 0.5; f *= 2.03; } return v / n; }; };
  const forest = new THREE.Color(0x3d4a2c), meadow = new THREE.Color(0x6b7449), stone = new THREE.Color(0x8d8c84), c = new THREE.Color();
  const ridge = (w, d, h, seed, x, z) => {
    const R = rngFrom(seed), noise = fbm(R);
    const g = new THREE.PlaneGeometry(w, d, 220, 60); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const px = p.getX(i), pz = p.getZ(i), across = clamp(1 - Math.abs(pz) / (d / 2), 0, 1), along = clamp(1 - Math.abs(px) / (w / 2), 0, 1);
      const shape = Math.pow(across, 0.8) * Math.min(1, along * 4);
      p.setY(i, Math.max(0, h * shape * (0.55 + 0.45 * noise(px + x, pz + z)) + 4 * noise(px * 7, pz * 7)) - 3);
    }
    g.computeVertexNormals();
    const col = [], nrm = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      const steep = 1 - nrm.getY(i), y = p.getY(i);
      c.copy(meadow).lerp(forest, clamp(y / 12, 0, 1)).lerp(stone, clamp((steep - 0.35) * 3, 0, 1)).multiplyScalar(0.85 + 0.3 * noise(p.getX(i) * 9, p.getZ(i) * 9));
      col.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    const m = new THREE.Mesh(g, mat); m.position.set(x, 0, z); scene.add(m);
  };
  ridge(900, 300, 70, 631, -480, -380);
  ridge(900, 300, 85, 632, 500, -420);
  ridge(1800, 360, 95, 633, 0, -900);
  ridge(1600, 300, 60, 634, 0, 520); // wooded rise inland
}

// ---------------- camp: tent, fire, smoke ----------------
// parts of a tent were found in the mound. The cloth here is a reconstruction.
{
  const cloth = std({ ...pbr("cloth", { repeat: [3, 2] }), color: 0x9d9686, side: THREE.DoubleSide }); // undyed wool
  const tent = new THREE.Group(), len = 5, half = 1.6, ht = 2.4;
  // each roof side is wool hanging from the ridge, sagging between the end frames
  for (const sd of [1, -1]) {
    const g = new THREE.PlaneGeometry(len, 1, 40, 16), p = g.attributes.position, R = rngFrom(sd > 0 ? 641 : 642);
    const wr = Array.from({ length: 6 }, () => [R() * 6, 2 + R() * 5, R() * 0.012]);
    for (let i = 0; i < p.count; i++) {
      const z = p.getX(i), t = 0.5 - p.getY(i); // t runs from 0 at the ridge to 1 at the hem
      const edge = Math.sin(Math.PI * (z / len + 0.5));
      const sag = 0.3 * Math.sin(Math.PI * t) * (0.35 + 0.65 * edge) + wr.reduce((acc, [ph, f, amp]) => acc + amp * Math.sin(z * f + ph) * t, 0);
      const x = sd * (half * t * 1.02) - sd * sag * Math.cos(Math.atan2(half, ht)), y = ht * (1 - t) - sag * Math.sin(Math.atan2(half, ht)) * 0.4;
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    tent.add(new THREE.Mesh(g, cloth));
  }
  const gable = new THREE.Shape([new THREE.Vector2(-half, 0), new THREE.Vector2(half, 0), new THREE.Vector2(0, ht)]);
  const gm = new THREE.Mesh(new THREE.ShapeGeometry(gable), cloth); gm.position.z = -len / 2; tent.add(gm);
  const door = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-half, 0), new THREE.Vector2(-0.5, 0), new THREE.Vector2(0, 1.5), new THREE.Vector2(0.5, 0), new THREE.Vector2(half, 0), new THREE.Vector2(0, ht)])), cloth); door.position.z = len / 2; tent.add(door);
  for (const z of [len / 2 + 0.05, -len / 2 - 0.05]) for (const sd of [1, -1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.1, 0.08), woodMat); b.position.set(sd * 0.55, 1.35, z); b.rotation.z = sd * 0.42; tent.add(b); }
  const ridgePole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len + 0.4, 8), woodMat); ridgePole.rotation.x = Math.PI / 2; ridgePole.position.y = ht + 0.02; tent.add(ridgePole);
  tent.position.set(-11.5, groundY(-11.5, 7), 7); tent.rotation.y = 0.5; add(tent, { solid: true });
}
const fireSpot = new THREE.Vector3(-8.95, 0.9, -2.6);
const fireLight = new THREE.PointLight(0xff8a3a, 6, 9, 2); fireLight.position.set(-8.95, 0.6, -2.6); scene.add(fireLight);
{
  const stones = [];
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; stones.push(new THREE.DodecahedronGeometry(0.13, 0).scale(1, 0.7, 1).translate(-8.95 + Math.cos(a) * 0.45, 0.07, -2.6 + Math.sin(a) * 0.45)); }
  add(new THREE.Mesh(mergeGeometries(stones), std({ ...pbr("rock"), color: 0x8c8c86 })));
  const logs = [];
  for (let i = 0; i < 4; i++) logs.push(new THREE.CylinderGeometry(0.045, 0.05, 0.7, 6).rotateZ(Math.PI / 2).rotateY((i / 4) * Math.PI).rotateZ(0.25).translate(-8.95, 0.12, -2.6));
  add(new THREE.Mesh(mergeGeometries(logs), std({ color: 0x2b1d14, roughness: 1 })));
}
// flames: two crossed cards with a soft fire gradient, flickering in updateWorld
const flames = new THREE.Group();
{
  const c = document.createElement("canvas"); c.width = 64; c.height = 128; const x = c.getContext("2d");
  const g = x.createRadialGradient(32, 108, 2, 32, 90, 60); g.addColorStop(0, "rgba(255,246,200,1)"); g.addColorStop(0.25, "rgba(255,190,80,0.95)"); g.addColorStop(0.6, "rgba(230,90,20,0.55)"); g.addColorStop(1, "rgba(160,40,0,0)");
  x.fillStyle = g; x.beginPath(); x.moveTo(32, 4); x.bezierCurveTo(60, 60, 58, 120, 32, 124); x.bezierCurveTo(6, 120, 4, 60, 32, 4); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
  for (let i = 0; i < 3; i++) { const q = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.75), m); q.rotation.y = (i * Math.PI) / 3; q.position.y = 0.3; flames.add(q); }
  flames.position.set(-8.95, 0.05, -2.6); scene.add(flames);
}
const puffTex = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d");
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, "rgba(220,220,218,0.55)"); g.addColorStop(1, "rgba(220,220,218,0)");
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const smoke = []; for (let i = 0; i < 10; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false })); scene.add(s); smoke.push(s); }

// gulls wheeling over the shore
const gulls = [];
{
  const body = std({ color: 0xe9e8e4, roughness: 0.8 }), tip = std({ color: 0x55575a, roughness: 0.8 });
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group(), R = rngFrom(700 + i);
    g.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.28, 3, 6).rotateX(Math.PI / 2), body));
    for (const sd of [1, -1]) {
      const w = new THREE.Group(); w.position.x = sd * 0.04;
      w.add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.012, 0.16).translate(sd * 0.21, 0, 0), body));
      w.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.01, 0.11).translate(sd * 0.52, 0, 0.02), tip));
      g.add(w); g.userData[sd > 0 ? "r" : "l"] = w;
    }
    g.userData.p = [R(), R(), R()]; scene.add(g); gulls.push(g);
  }
}

// Per-frame updates for the world.
function updateWorld(time, dt) {
  if (water.material.uniforms) water.material.uniforms.time.value += dt * 0.6;
  else water.material.normalMap.offset.set(time * 0.01, time * 0.006);
  foamTex.offset.x = time * 0.004; foam.position.z = Math.sin(time * 0.55) * 0.35;
  sky.position.copy(camera.position);
  gulls.forEach((g, i) => {
    const [r1, r2, r3] = g.userData.p, a = time * (0.12 + r1 * 0.05) + i, rad = 25 + r2 * 15;
    g.position.set(Math.cos(a) * rad - 5, 14 + r3 * 8 + Math.sin(time + i) * 0.5, Math.sin(a) * (20 + r3 * 10) - 25);
    g.rotation.y = -a; g.rotation.z = 0.25;
    const flap = Math.sin(time * 6 + i * 2) * 0.45; g.userData.r.rotation.z = flap; g.userData.l.rotation.z = -flap;
  });
  const f = 0.85 + 0.15 * Math.sin(time * 13) * Math.sin(time * 7.3);
  fireLight.intensity = 6 * f; flames.scale.set(1, 0.85 + 0.3 * f, 1);
}

export { SEA_Y, SHORE_Z, shoreZ, groundY, ground, grass, water, sky, smoke, fireSpot, updateWorld };
