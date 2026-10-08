// Screenshots for milestone previews. Run `npm run build` first.
// Usage: node scripts/shots.mjs <outDir> [view ...]   views: intro, stop1..stop12, deck, sail, overview
import { chromium } from "@playwright/test";
import { preview } from "vite";
import fs from "node:fs";

const [outDir = "shots", ...wanted] = process.argv.slice(2);
const views = wanted.length ? wanted : ["stop1", "overview", "deck"];
const sizes = (process.env.SIZES || "1600x900").split(",").map((s) => s.split("x").map(Number));
const hideUi = process.env.HIDE_UI === "1";

fs.mkdirSync(outDir, { recursive: true });
const PORT = Number(process.env.PORT || 4174);
const server = await preview({ preview: { port: PORT, strictPort: true } });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader-webgl", "--enable-unsafe-swiftshader", "--disable-gpu-rasterization"] });
for (const [w, h] of sizes) for (const v of views) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on("pageerror", (e) => console.error(v, "pageerror", e.message));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.error(v, m.type(), m.text().slice(0, 300)); });
  page.on("requestfailed", (r) => console.error(v, "failed", r.url()));
  const hash = v.startsWith("stop") ? `#stop=${v.slice(4)}` : ["deck", "overview"].includes(v) ? `#${v}` : v === "sail" ? "#sail&stop=6" : "";
  await page.goto(`http://localhost:${PORT}/${hash}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180_000, polling: 500 });
  await page.waitForTimeout(v === "overview" ? 6000 : 2500);
  if (hideUi) await page.addStyleTag({ content: ".bar,.panel,.pad,#markers,.hint,.modal-back,#loader{display:none!important}" });
  const file = `${outDir}/${v}-${w}.png`;
  const t0 = Date.now(); await page.screenshot({ path: file, timeout: 600_000 });
  const fps = await page.evaluate(() => new Promise((r) => { let n = 0; const t = performance.now(); const f = () => (++n < 5 ? requestAnimationFrame(f) : r(5000 / (performance.now() - t))); requestAnimationFrame(f); }));
  console.log("  screenshot ms", Date.now() - t0, "fps", fps.toFixed(2));
  console.log("saved", file);
  await page.close();
}
await browser.close();
server.httpServer.close();
