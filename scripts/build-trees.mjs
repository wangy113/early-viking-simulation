// Packs the plant renders from scripts/trees/render_impostors.py into texture atlases: one for the
// trees of the woods, and one each for the ferns and young pines below them.
// Each row is one plant, each column one of 8 viewing directions.
//   node scripts/build-trees.mjs [renderDir]   (default assets-src/trees)
import fs from "node:fs";
import sharp from "sharp";

const src = process.argv[2] || "assets-src/trees";
// name, plants, frame size in the renders, frame width in the 1k and 2k atlases
const sets = [
  ["trees", ["pine_tree_01_a_LOD1", "pine_tree_01_b_LOD1", "pine_tree_01_c_LOD1"], [320, 768], [128, 256]],
  ["ferns", ["fern_02_b", "fern_02_c"], [384, 192], [96, 192]],
  ["saplings", ["pine_sapling_small_a", "pine_sapling_small_b"], [384, 384], [96, 192]],
];
const out = "public/assets/trees";
fs.mkdirSync(out, { recursive: true });

// Transparent pixels take the colour of their nearest leaf, so mipmaps do not draw dark outlines.
function bleed(data, w, h, passes = 8) {
  for (let p = 0; p < passes; p++) {
    const next = Buffer.from(data);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] > 8) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = (yy * w + xx) * 4; if (data[j + 3] > 8 || (p > 0 && data[j] + data[j + 1] + data[j + 2] > 0)) { r += data[j]; g += data[j + 1]; b += data[j + 2]; n++; }
      }
      if (n) { next[i] = r / n; next[i + 1] = g / n; next[i + 2] = b / n; }
    }
    data.set(next);
  }
}

const manifest = { frames: 8 };
for (const [set, plants, [rw, rh], widths] of sets) {
  const info = manifest[set] = { trees: [], atlas: {} };
  for (const t of plants) {
    const [height, width] = fs.readFileSync(`${src}/${t}.txt`, "utf8").trim().split(/\s+/).map(Number);
    info.trees.push({ name: t.replace(/_LOD1$/, ""), height, width });
  }
  for (const [key, fw] of [["1k", widths[0]], ["2k", widths[1]]]) {
    const fh = Math.round((fw * rh) / rw), W = fw * 8, Hh = fh * plants.length;
    const tiles = [];
    for (const [row, t] of plants.entries()) for (let k = 0; k < 8; k++) {
      const { data, info: im } = await sharp(`${src}/${t}_${k}.png`).ensureAlpha().resize(fw, fh).raw().toBuffer({ resolveWithObject: true });
      bleed(data, im.width, im.height);
      tiles.push({ input: data, raw: { width: fw, height: fh, channels: 4 }, left: k * fw, top: row * fh });
    }
    const file = `${set}_${key}.webp`;
    await sharp({ create: { width: W, height: Hh, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(tiles).webp({ quality: 88, alphaQuality: 95 }).toFile(`${out}/${file}`);
    info.atlas[key] = `trees/${file}`;
    console.log(file, W, "x", Hh, (fs.statSync(`${out}/${file}`).size / 1e6).toFixed(2), "MB");
  }
}
fs.writeFileSync("src/trees-manifest.json", JSON.stringify(manifest, null, 2) + "\n");
