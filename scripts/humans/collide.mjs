// Plays every task loop and reports body parts that end up on the wrong side of the hull:
// inside the ship for people on the beach, outside the planking for people on deck.
// Run `npm run build` first. Usage: node scripts/humans/collide.mjs
import { chromium } from "@playwright/test";
import { preview } from "vite";
import { hullCheck, gripCheck } from "../../tests/hull-check.js";
const PORT = Number(process.env.PORT || 4420);
const server = await preview({ preview: { port: PORT, strictPort: true } });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader-webgl", "--enable-unsafe-swiftshader", "--disable-gpu-rasterization"] });
const page = await browser.newPage({ viewport: { width: 200, height: 150 } });
await page.goto(`http://localhost:${PORT}/?debug&quality=low`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 240_000, polling: 500 });
const report = await page.evaluate(hullCheck);
console.log(report.length ? report.join("\n") : "no parts through the hull");
const grips = await page.evaluate(gripCheck);
console.log(grips.length ? grips.join("\n") : "every hand reaches its grip");
await browser.close(); await server.close();
