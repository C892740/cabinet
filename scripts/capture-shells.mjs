/**
 * Capture the console-style shells + achievement screens for visual review.
 * Usage: node scripts/capture-shells.mjs [baseURL]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://127.0.0.1:3000";
const out = "artifacts/shells";
mkdirSync(out, { recursive: true });

const shells = ["ps5", "nintendo", "dual", "xmb"];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

// Library with real cover candidates + achievement chips
await page.goto(`${base}/library`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500); // let cover failover settle
await page.screenshot({ path: `${out}/library.png` });

// Each shell
for (const shell of shells) {
  await page.addInitScript((id) => window.localStorage.setItem("cabinet.shell", id), shell);
  await page.goto(`${base}/shell`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${out}/shell-${shell}.png` });
}

// Achievements modal — open Super Metroid (demo fixture set)
await page.goto(`${base}/library`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const card = page.getByRole("button", { name: /Open Super Metroid/ });
if (await card.count()) {
  await card.first().click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/achievements-modal.png` });
  // scroll the modal to the achievements section
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/achievements-list.png` });
}

await browser.close();
console.log(`captured to ${out}/`);
