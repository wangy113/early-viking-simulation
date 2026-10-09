// Views from inside the ship toward the people working on the hull, to catch heads or hands
// poking through the planks. Usage: node scripts/humans/inside.mjs <outDir>
import { chromium } from "@playwright/test";
import { preview } from "vite";
import fs from "node:fs";
const [outDir = "shots/inside"] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const PORT = Number(process.env.PORT || 4410);
const server = await preview({ preview: { port: PORT, strictPort: true } });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader-webgl", "--enable-unsafe-swiftshader", "--disable-gpu-rasterization"] });
const url = (hash) => `http://localhost:${PORT}/?debug&quality=low${hash}`;
const ready = (page) => page.waitForFunction(() => window.__ready === true, null, { timeout: 240_000, polling: 500 });
let page = await browser.newPage({ viewport: { width: 300, height: 200 } });
await page.goto(url("")); await ready(page);
const cams = await page.evaluate(() => {
  const out = {};
  for (const name of ["wright", "caulk", "chest"]) {
    const p = window.__cast[name].mesh.position;
    const side = Math.sign(p.x);
    out[name] = [side * 0.3, 2.3, p.z + 0.6, p.x, 1.3, p.z].map((v) => v.toFixed(2)).join(",");
  }
  return out;
});
await page.close();
for (const [name, cam] of Object.entries(cams)) {
  const p = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await p.goto(url(`#cam=${cam}`)); await ready(p); await p.waitForTimeout(1500);
  await p.addStyleTag({ content: ".bar,.panel,.pad,.hint,dialog,#loader,#debug{display:none!important}" });
  for (const t of [0, 1]) { await p.screenshot({ path: `${outDir}/${name}${t}.png`, timeout: 600_000 }); await p.waitForTimeout(700); }
  console.log("saved", name); await p.close();
}
await browser.close(); await server.close();
