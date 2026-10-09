// Resizes and compresses the sources in assets-src/ into public/assets/ for the web,
// and writes the texture manifest and CREDITS.md.
import fs from "node:fs";
import sharp from "sharp";

const cfg = JSON.parse(fs.readFileSync("scripts/textures.config.json", "utf8"));
const credits = JSON.parse(fs.readFileSync("assets-src/credits.json", "utf8"));
const out = "public/assets";
fs.mkdirSync(`${out}/tex`, { recursive: true }); fs.mkdirSync(`${out}/sky`, { recursive: true });

const manifest = { textures: {}, sizes: cfg.sizes, sky: {} };
for (const [role, id] of Object.entries(cfg.textures)) {
  manifest.textures[role] = {};
  for (const map of ["diff", "nor", "arm"]) {
    for (const size of cfg.sizes) {
      const file = `tex/${role}_${map}_${size / 1024}k.webp`;
      await sharp(`assets-src/textures/${id}/${map}.jpg`).resize(size, size).webp({ quality: map === "nor" ? 92 : 85 }).toFile(`${out}/${file}`);
      (manifest.textures[role][map] ||= {})[size] = file;
    }
  }
}
{
  const dir = `assets-src/hdri/${cfg.hdri}`;
  fs.copyFileSync(`${dir}/light_1k.hdr`, `${out}/sky/light_1k.hdr`);
  // The sky is sampled as a full equirectangular image, the same way three.js samples environments.
  await sharp(`${dir}/backdrop.jpg`, { limitInputPixels: false }).resize(4096, 2048).jpeg({ quality: 86, mozjpeg: true }).toFile(`${out}/sky/backdrop.jpg`);
  manifest.sky = { light: "sky/light_1k.hdr", backdrop: "sky/backdrop.jpg" };
}
fs.writeFileSync("src/assets-manifest.json", JSON.stringify(manifest, null, 2) + "\n");

const lines = ["# Asset credits", "", "All textures and sky images come from [Poly Haven](https://polyhaven.com) and are released under CC0 (public domain). Attribution is not required. We credit the authors as good academic practice.", "", "| Use | Asset | Authors | Source |", "|---|---|---|---|"];
for (const c of credits) lines.push(`| ${c.role} | ${c.name} | ${c.authors.join(", ")} | https://polyhaven.com/a/${c.id} |`);
lines.push("", "## Trees", "", "The woods are renders of Fir Tree 01 and Pine Tree 01 by Rob Tuytel and Rico Cilliers, from Poly Haven, released under CC0. https://polyhaven.com/a/fir_tree_01 and https://polyhaven.com/a/pine_tree_01. They were rendered from 8 directions by `scripts/trees/render_impostors.py`.");
lines.push("", "## People", "", "The bodies, skins, eyes, eyebrows, eyelashes and hair of the people are MakeHuman system assets, released under CC0 by Data Collection AB, Joel Palmius and Jonas Hauquier. https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html", "", "The beards come from the MakeHuman bodyparts05 pack, released under CC0: Viking beard and Viking moustache by RehmanPolanski, scruffy beard by WDG, Sigmund beard by grinsegold. https://static.makehumancommunity.org/assets/assetpacks/bodyparts05.html", "", "They were assembled with MPFB, the MakeHuman plugin for Blender. The Viking clothing is made by our own script, `scripts/humans/make_human.py`.");
lines.push("", "The sea normal map `tex/waternormals.jpg` is from the three.js examples (MIT License), https://github.com/mrdoob/three.js/tree/r181/examples/textures");
fs.writeFileSync(`${out}/CREDITS.md`, lines.join("\n") + "\n");
console.log("built", Object.keys(manifest.textures).length, "texture sets");
