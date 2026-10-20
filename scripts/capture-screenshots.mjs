/**
 * Captures the README screenshots from a running Cabinet instance.
 *
 * Usage:
 *   npm run dev            # in another terminal (http://localhost:3000)
 *   node scripts/capture-screenshots.mjs
 *
 * Requires Playwright:  npm i -D playwright && npx playwright install chromium
 */

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.CABINET_URL ?? "http://localhost:3000";
const OUT = path.resolve("docs/screenshots");
mkdirSync(OUT, { recursive: true });

const viewports = {
  desktop: { width: 1600, height: 1000 },
  wide: { width: 1600, height: 900 },
};

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: viewports.desktop,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // 1) Landing hero
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, "hero.png") });

  // 2) Library grid
  await page.goto(`${BASE}/library`, { waitUntil: "load" });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: path.join(OUT, "library.png") });

  // 3) TV mode
  await page.goto(`${BASE}/tv`, { waitUntil: "load" });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: path.join(OUT, "tv-mode.png") });

  // 4) Admin dashboard — unlock with the dev admin key, then capture
  await page.goto(`${BASE}/admin`, { waitUntil: "load" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, "admin-locked.png") });

  const unlocked = await page.evaluate(async () => {
    const response = await fetch("/api/admin/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "cabinet-dev-admin-key" }),
    });
    return (await response.json()).ok;
  });
  if (unlocked) {
    await page.goto(`${BASE}/admin`, { waitUntil: "load" });
    await page.waitForTimeout(2200);
    await page.screenshot({ path: path.join(OUT, "admin.png") });
  }

  // 5) Key vault window (renders standalone for the screenshot)
  await page.setViewportSize({ width: 820, height: 1000 });
  await page.goto(`file://${path.resolve("apps/desktop/windows/keyvault.html")}`);
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "keyvault.png") });

  await browser.close();
  console.log(`✔ screenshots written to ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
