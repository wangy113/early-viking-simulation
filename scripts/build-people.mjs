// Builds the realistic people from scripts/humans/figures.json.
// Needs Blender 4.2 with the MPFB extension and the CC0 MakeHuman asset packs installed
// (see scripts/humans/README.md). Writes public/assets/people/ and src/people-manifest.json.
//
//   BLENDER=/path/to/blender MPFB_DATA=/path/to/mpfb/data node scripts/build-people.mjs [body ...]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { NodeIO } from "@gltf-transform/core";
import { EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { dedup, prune, quantize, meshopt, weld } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";

const BLENDER = process.env.BLENDER || "/opt/tools/blender-4.2.23-linux-x64/blender";
const DATA = process.env.MPFB_DATA || `${process.env.HOME}/.config/blender/4.2/extensions/.user/user_default/mpfb/data`;
const spec = JSON.parse(fs.readFileSync("scripts/humans/figures.json", "utf8"));
const only = process.argv.slice(2);
const src = "assets-src/people", out = "public/assets/people";
fs.mkdirSync(src, { recursive: true }); fs.mkdirSync(out, { recursive: true });

// ---------------- bodies ----------------
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const bodies = {};
for (const [name, b] of Object.entries(spec.bodies)) {
  bodies[name] = `${name}.glb`;
  if (only.length && !only.includes(name)) continue;
  const job = {
    info: {
      phenotype: { cupsize: 0.5, firmness: 0.5, ...b.phenotype, race: { asian: 0, caucasian: 1, african: 0 } },
      rig: "game_engine", eyes: "low-poly.mhclo", eyebrows: "eyebrow001.mhclo", eyelashes: "eyelashes01.mhclo",
      hair: b.hair ? `${b.hair}.mhclo` : "", proxy: b.phenotype.gender > 0.5 ? "male_generic.proxy" : "female_generic.proxy",
      skin_mhmat: `${b.skin_mhmat}.mhmat`, skin_material_type: "MAKESKIN", eyes_material_type: "MAKESKIN",
      clothes: b.beard ? [`${b.beard}.mhclo`] : [],
    },
    garments: Object.fromEntries(b.garments.map((g) => [g, true])),
    skin: b.skin, decimate: b.decimate ?? 0.55,
  };
  const jobFile = path.resolve(`${src}/${name}.json`), raw = path.resolve(`${src}/${name}.glb`);
  fs.writeFileSync(jobFile, JSON.stringify(job, null, 2));
  execFileSync(BLENDER, ["--background", "--python", path.resolve("scripts/humans/make_human.py"), "--", jobFile, raw], { stdio: ["ignore", "ignore", "inherit"] });
  const doc = await io.read(raw);
  await doc.transform(weld(), dedup(), prune({ keepLeaves: true }), quantize(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  await io.write(`${out}/${name}.glb`, doc);
  console.log(name, (fs.statSync(raw).size / 1e6).toFixed(2), "MB ->", (fs.statSync(`${out}/${name}.glb`).size / 1e6).toFixed(2), "MB");
}

// ---------------- textures ----------------
// Skins and eyes keep their colour. Hair, beards and brows become grey strands with alpha,
// normalised in brightness, so the app can tint them to any hair colour.
const textures = {};
async function colour(key, file, size) {
  textures[key] = `${key}.webp`;
  await sharp(file).resize(size, size).webp({ quality: 85 }).toFile(`${out}/${key}.webp`);
}
async function strands(key, file, size = 1024) {
  textures[key] = `${key}.webp`;
  const { data, info } = await sharp(file).ensureAlpha().resize(size, size).raw().toBuffer({ resolveWithObject: true });
  let sum = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 128) { sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]; n++; }
  const gain = n ? (0.8 * 255) / (sum / n) : 1;
  for (let i = 0; i < data.length; i += 4) {
    const l = Math.min(255, (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) * gain);
    data[i] = data[i + 1] = data[i + 2] = l;
  }
  await sharp(data, { raw: info }).webp({ quality: 88, alphaQuality: 90 }).toFile(`${out}/${key}.webp`);
}
const mhmatTexture = (dir) => {
  const mat = fs.readdirSync(dir).find((f) => f.endsWith(".mhmat"));
  const line = fs.readFileSync(`${dir}/${mat}`, "utf8").split("\n").find((l) => l.startsWith("diffuseTexture"));
  return `${dir}/${path.basename(line.split(/\s+/)[1])}`;
};
const skins = new Set(), hairs = new Set(), beards = new Set();
for (const b of Object.values(spec.bodies)) { skins.add(`${b.skin}:${b.skin_mhmat}`); if (b.hair) hairs.add(b.hair); if (b.beard) beards.add(b.beard); }
for (const s of skins) { const [key, mh] = s.split(":"); await colour(`skin_${key}`, mhmatTexture(`${DATA}/skins/${mh}`), 1024); }
for (const e of ["brown", "blue", "grey"]) await colour(`eye_${e}`, `${DATA}/eyes/materials/${e}_eye.png`, 256);
for (const h of hairs) await strands(`hair_${h}`, mhmatTexture(`${DATA}/hair/${h}`));
for (const b of beards) await strands(`beard_${b}`, mhmatTexture(`${DATA}/clothes/${b}`), 512);
await strands("brow", `${DATA}/eyebrows/eyebrow001/eyebrow001.png`, 256);
await strands("lash", `${DATA}/eyelashes/eyelashes01/eyelashes01.png`, 256);

fs.writeFileSync("src/people-manifest.json", JSON.stringify({ bodies, textures }, null, 2) + "\n");
console.log("people:", Object.keys(bodies).length, "bodies,", Object.keys(textures).length, "textures");
