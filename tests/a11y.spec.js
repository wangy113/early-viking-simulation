import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import stops from "../src/content/stops.json" with { type: "json" };

const ready = (page) => page.waitForFunction(() => window.__ready === true, null, { timeout: 180_000, polling: 500 });
// WCAG 2.1 A and AA rules. The 3D canvas is an image with a text alternative, so axe checks the page around it.
const axe = (page) => new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
const summary = (r) => r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);

test("no WCAG A or AA problems in the welcome, a stop, the stop list and the text version", async ({ page }) => {
  await page.goto("./?quality=low");
  await ready(page);
  expect(summary(await axe(page))).toEqual([]);
  await page.getByRole("button", { name: "Start exploring" }).click();
  await page.locator(".marker").first().evaluate((b) => b.click());
  await expect(page.locator("#panel")).toBeVisible();
  expect(summary(await axe(page))).toEqual([]);
  await page.getByRole("button", { name: "All stops" }).click();
  expect(summary(await axe(page))).toEqual([]);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Text version" }).click();
  expect(summary(await axe(page))).toEqual([]);
});

test("the keyboard alone reaches every stop through the stop list, and focus comes back", async ({ page }) => {
  await page.goto("./?quality=low");
  await ready(page);
  await expect(page.locator("#start")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#guide")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#stopsBtn")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#stopsModal")).toBeVisible();
  await expect(page.locator("#stopList button")).toHaveCount(stops.length);
  // Tab past the close button to stop 3
  for (let i = 0; i < 3; i++) await page.keyboard.press("Tab");
  await expect(page.locator("#stopList button").nth(2)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#pTitle")).toHaveText(`3. ${stops[2].title}`);
  await expect(page.locator("#pTitle")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#panel")).toBeHidden();
  await expect(page.locator("#stopsBtn")).toBeFocused();
  // dialogs return focus to the button that opened them
  await page.locator("#textBtn").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#textModal")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#textBtn")).toBeFocused();
});

test("Pause motion is a visible toggle, and motion starts paused when reduced motion is asked for", async ({ browser }) => {
  const page = await browser.newPage({ reducedMotion: "reduce", viewport: { width: 800, height: 450 } });
  await page.goto("./?quality=low");
  await ready(page);
  await page.getByRole("button", { name: "Start exploring" }).click();
  const btn = page.locator("#motionBtn");
  await expect(btn).toHaveText("Play motion");
  await expect(btn).toHaveAttribute("aria-pressed", "true");
  await btn.click();
  await expect(btn).toHaveText("Pause motion");
  await expect(btn).toHaveAttribute("aria-pressed", "false");
  await page.close();
});

test("at 320 pixels wide nothing scrolls sideways and the Menu holds the tools", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true });
  await page.goto("./?quality=low");
  await ready(page);
  await page.getByRole("button", { name: "Start exploring" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const menu = page.locator("#menuBtn");
  await expect(menu).toBeVisible();
  await expect(page.locator("#textBtn")).toBeHidden();
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await page.locator("#textBtn").click();
  await expect(page.locator("#textModal")).toBeVisible();
  // touch targets are at least 44 pixels
  const small = await page.evaluate(() => [...document.querySelectorAll("button")].filter((b) => b.offsetParent && (b.getBoundingClientRect().height < 44 || b.getBoundingClientRect().width < 44)).map((b) => b.id || b.textContent.trim().slice(0, 20)));
  expect(small).toEqual([]);
  await page.close();
});
