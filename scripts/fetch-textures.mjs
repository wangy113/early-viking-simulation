// Downloads the CC0 source textures named in scripts/textures.config.json from Poly Haven
// into assets-src/ (git ignored). Files are checked against Poly Haven's md5 sums.
import fs from "node:fs";
import crypto from "node:crypto";

const cfg = JSON.parse(fs.readFileSync("scripts/textures.config.json", "utf8"));
const API = "https://api.polyhaven.com";
const getJson = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${r.status} ${u}`); return r.json(); };

async function download(file, dest) {
  if (fs.existsSync(dest) && crypto.createHash("md5").update(fs.readFileSync(dest)).digest("hex") === file.md5) return "cached";
  const r = await fetch(file.url); if (!r.ok) throw new Error(`${r.status} ${file.url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (crypto.createHash("md5").update(buf).digest("hex") !== file.md5) throw new Error(`md5 mismatch for ${file.url}`);
  fs.writeFileSync(dest, buf); return "downloaded";
}

const credits = [];
for (const [role, id] of Object.entries(cfg.textures)) {
  const dir = `assets-src/textures/${id}`; fs.mkdirSync(dir, { recursive: true });
  const files = await getJson(`${API}/files/${id}`), info = await getJson(`${API}/info/${id}`);
  for (const [map, key] of [["diff", "Diffuse"], ["nor", "nor_gl"], ["arm", "arm"]]) {
    const f = files[key]["2k"].jpg;
    console.log(`${role} ${id} ${map}: ${await download(f, `${dir}/${map}.jpg`)}`);
  }
  credits.push({ role, id, name: info.name, authors: Object.keys(info.authors) });
}
{
  const id = cfg.hdri, dir = `assets-src/hdri/${id}`; fs.mkdirSync(dir, { recursive: true });
  const files = await getJson(`${API}/files/${id}`), info = await getJson(`${API}/info/${id}`);
  console.log(`hdri light: ${await download(files.hdri["1k"].hdr, `${dir}/light_1k.hdr`)}`);
  console.log(`hdri backdrop: ${await download(files.tonemapped, `${dir}/backdrop.jpg`)}`);
  credits.push({ role: "sky", id, name: info.name, authors: Object.keys(info.authors) });
}
fs.writeFileSync("assets-src/credits.json", JSON.stringify(credits, null, 2));
