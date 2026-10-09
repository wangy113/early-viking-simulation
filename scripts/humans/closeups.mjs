// Close-up screenshots of each actor, for checking the people. Run `npm run build` first.
// Usage: node scripts/humans/closeups.mjs <outDir> [actor ...]
import { chromium } from "@playwright/test";
import { preview } from "vite";
import fs from "node:fs";
const [outDir = "shots/people", ...wanted] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const PORT = Number(process.env.PORT || 4400);
const server = await preview({ preview: { port: PORT, strictPort: true } });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader-webgl", "--enable-unsafe-swiftshader", "--disable-gpu-rasterization"] });
const url = (hash) => `http://localhost:${PORT}/?debug&quality=${process.env.QUALITY || "high"}${hash}`;
const ready = (page) => page.waitForFunction(() => window.__ready === true, null, { timeout: 240_000, polling: 500 });
let page = await browser.newPage({ viewport: { width: 400, height: 300 } });
await page.goto(url("")); await ready(page);
// camera in front of each person, at chest height, 2.4 m away
const cams = await page.evaluate(() => {
  const out = {};
  for (const [name, a] of Object.entries(window.__cast)) {
    a.mesh.updateMatrixWorld(true);
    const people = []; a.mesh.traverse((o) => { if (o.userData?.isHuman) people.push(o); });
    people.forEach((p, i) => {
      const pos = p.getWorldPosition(new p.position.constructor()), q = p.getWorldQuaternion(new p.quaternion.constructor());
      const fwd = new p.position.constructor(0, 0, 1).applyQuaternion(q), side = new p.position.constructor(1, 0, 0).applyQuaternion(q);
      // most people face their work, so look from the side for the ones facing the hull
      const ang = { wright: 1.9, caulk: 1.7, shield: -1.2, rope: 2.6, steer: -0.6, chest: 0.9 }[name] ?? 0.35, d = 2.3;
      const dir = fwd.clone().multiplyScalar(Math.cos(ang)).addScaledVector(side, Math.sin(ang));
      const cam = pos.clone().addScaledVector(dir, d); cam.y += 1.4;
      const look = pos.clone(); look.y += 1.05;
      out[`${name}${people.length > 1 ? i + 1 : ""}`] = [cam.x, cam.y, cam.z, look.x, look.y, look.z].map((v) => v.toFixed(2)).join(",");
    });
  }
  return out;
});
await page.close();
const list = Object.entries(cams).filter(([n]) => !wanted.length || wanted.includes(n));
const w = Number(process.env.W || 900), h = Number(process.env.H || 900);
await Promise.all([0, 1].map(async (lane) => {
  for (const [name, cam] of list.filter((_, i) => i % 2 === lane)) {
    const p = await browser.newPage({ viewport: { width: w, height: h } });
    await p.goto(url(`#cam=${cam}`)); await ready(p); await p.waitForTimeout(2000);
    await p.addStyleTag({ content: ".bar,.panel,.pad,#markers,.hint,.modal-back,#loader,#debug{display:none!important}" });
    await p.screenshot({ path: `${outDir}/${name}.png`, timeout: 600_000 });
    console.log("saved", name); await p.close();
  }
}));
await browser.close(); await server.close();
