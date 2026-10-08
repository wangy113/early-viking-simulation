import { test, expect } from "@playwright/test";
import stops from "../src/content/stops.json" with { type: "json" };

const ready = (page) => page.waitForFunction(() => window.__ready === true, null, { timeout: 180_000, polling: 500 });

function trackErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  return errors;
}

test("loads with the intro and no errors", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("./?quality=low");
  await ready(page);
  await expect(page.locator("#introTitle")).toBeVisible();
  await expect(page.locator("#progress")).toHaveText(`0 of ${stops.length} stops`);
  await expect(page.locator(".marker")).toHaveCount(stops.length);
  expect(errors).toEqual([]);
});

test("makes no requests to other hosts", async ({ page }) => {
  const external = [];
  page.on("request", (r) => { if (!r.url().startsWith("http://localhost:4173/") && !r.url().startsWith("data:") && !r.url().startsWith("blob:")) external.push(r.url()); });
  await page.goto("./?quality=low");
  await ready(page);
  expect(external).toEqual([]);
});

for (const [i, stop] of stops.entries()) {
  test(`#stop=${i + 1} opens "${stop.title}"`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(`./?quality=low#stop=${i + 1}`);
    await ready(page);
    await expect(page.locator("#intro")).toBeHidden();
    await expect(page.locator("#pTitle")).toHaveText(`${i + 1}. ${stop.title}`);
    await expect(page.locator("#pBody .notice")).toContainText(stop.notice);
    expect(errors).toEqual([]);
  });
}

test("the text version lists every stop", async ({ page }) => {
  await page.goto("./?quality=low");
  await ready(page);
  await page.getByRole("button", { name: "Start exploring" }).click();
  await page.getByRole("button", { name: "Text version" }).click();
  for (const [i, stop] of stops.entries()) await expect(page.locator("#textStops h2").nth(i)).toHaveText(`${i + 1}. ${stop.title}`);
});

test("#deck starts on board and #sail raises the sail", async ({ page }) => {
  await page.goto("./?quality=low#deck&sail");
  await ready(page);
  await expect(page.locator("#board")).toHaveText("Step ashore");
  await expect(page.locator("#sailBtn")).toHaveText("Lower the sail");
});

test("the quality button shows the level and offers to change it", async ({ page }) => {
  await page.goto("./?quality=low");
  await ready(page);
  await expect(page.locator("#qualityBtn")).toHaveText("Quality: Low");
  await expect(page.locator("#qualityBtn")).toHaveAttribute("aria-label", /Press to change/);
});

test("Low quality loads only the small textures", async ({ page }) => {
  const big = [];
  page.on("request", (r) => { if (/_2k\.webp$/.test(r.url())) big.push(r.url()); });
  await page.goto("./?quality=low");
  await ready(page);
  expect(big).toEqual([]);
});
