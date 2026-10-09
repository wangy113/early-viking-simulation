// Screenshots of the interface on a phone and a desktop, for milestone previews.
// Run `npm run build` first. Usage: node scripts/ui-shots.mjs <outDir>
import { chromium } from "@playwright/test";
import { preview } from "vite";
import fs from "node:fs";
const [outDir = "shots/ui"] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const PORT = Number(process.env.PORT || 4450);
const server = await preview({ preview: { port: PORT, strictPort: true } });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader-webgl", "--enable-unsafe-swiftshader", "--disable-gpu-rasterization"] });
const ready = (p) => p.waitForFunction(() => window.__ready === true, null, { timeout: 240_000, polling: 500 });
const shot = async (p, name) => { await p.waitForTimeout(1500); await p.screenshot({ path: `${outDir}/${name}.png`, timeout: 600_000 }); console.log("saved", name); };
const devices = { phone: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }, desktop: { viewport: { width: 1366, height: 768 } } };
for (const [kind, opts] of Object.entries(devices)) {
  const p = await browser.newPage(opts);
  await p.goto(`http://localhost:${PORT}/?quality=low`); await ready(p);
  await shot(p, `${kind}-1-welcome`);
  await p.getByRole("button", { name: "Start exploring" }).click();
  if (kind === "phone") { await p.locator("#menuBtn").click(); await shot(p, `${kind}-2-menu`); }
  await p.locator("#stopsBtn").click(); await shot(p, `${kind}-3-stops`);
  await p.locator("#stopList button").nth(8).click(); await p.waitForTimeout(2500); await shot(p, `${kind}-4-stop`);
  await p.close();
}
await browser.close(); await server.close();
