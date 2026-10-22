/**
 * Capture the Emulators wing + player screens and collect console/page errors.
 * Usage: node scripts/capture-emulator-wing.mjs [baseUrl]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
mkdirSync("artifacts/emulators", { recursive: true });

const errors = [];

const targets = [
  { url: `${base}/emulators`, name: "emulators.png" },
  { url: `${base}/play?rom=rom_019`, name: "play.png" },
];

// A fresh browser per page: this VM's headless shell dies under memory
// pressure when several heavy pages share one context.
for (const target of targets) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`[${target.name}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`[${target.name}] ${err.message}`));
  await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `artifacts/emulators/${target.name}`, fullPage: false });
  console.log(`captured ${target.name}`);
  await browser.close().catch(() => undefined);
}
if (errors.length) {
  console.log("ERRORS:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("no console/page errors");
