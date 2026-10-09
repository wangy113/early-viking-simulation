// Packs the tree renders from scripts/trees/render_impostors.py into one texture atlas for the woods.
// Each row is one tree, each column one of 8 viewing directions.
//   node scripts/build-trees.mjs [renderDir]   (default assets-src/trees)
import fs from "node:fs";
import sharp from "sharp";

const src = process.argv[2] || "assets-src/trees";
const trees = ["fir_tree_01_a_LOD1", "fir_tree_01_b_LOD1", "pine_tree_01_a_LOD1", "pine_tree_01_b_LOD1", "pine_tree_01_c_LOD1"];
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

const manifest = { frames: 8, trees: [], atlas: {} };
for (const t of trees) {
  const [height, width] = fs.readFileSync(`${src}/${t}.txt`, "utf8").trim().split(/\s+/).map(Number);
  manifest.trees.push({ name: t.replace(/_LOD1$/, ""), height, width });
}
for (const [key, fw] of [["1k", 128], ["2k", 256]]) {
  const fh = Math.round((fw * 768) / 320), W = fw * 8, Hh = fh * trees.length;
  const tiles = [];
  for (const [row, t] of trees.entries()) for (let k = 0; k < 8; k++) {
    const { data, info } = await sharp(`${src}/${t}_${k}.png`).ensureAlpha().resize(fw, fh).raw().toBuffer({ resolveWithObject: true });
    bleed(data, info.width, info.height);
    tiles.push({ input: data, raw: { width: fw, height: fh, channels: 4 }, left: k * fw, top: row * fh });
  }
  const file = `trees_${key}.webp`;
  await sharp({ create: { width: W, height: Hh, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(tiles).webp({ quality: 88, alphaQuality: 95 }).toFile(`${out}/${file}`);
  manifest.atlas[key] = `trees/${file}`;
  console.log(file, W, "x", Hh, (fs.statSync(`${out}/${file}`).size / 1e6).toFixed(2), "MB");
}
fs.writeFileSync("src/trees-manifest.json", JSON.stringify(manifest, null, 2) + "\n");
