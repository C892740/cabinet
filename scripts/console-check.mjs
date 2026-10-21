import { chromium } from "playwright";
const base = process.argv[2] ?? "http://127.0.0.1:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text().slice(0, 500)); });
page.on("pageerror", (err) => errors.push("PAGEERROR: " + String(err).slice(0, 600)));

// mirror capture-shells: a /library visit first
await page.goto(`${base}/library`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

for (const shell of ["ps5", "nintendo", "dual", "xmb"]) {
  errors.length = 0;
  await page.addInitScript((id) => window.localStorage.setItem("cabinet.shell", id), shell);
  await page.goto(`${base}/shell`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  console.log(`--- ${shell}: ${errors.length === 0 ? "clean" : ""}`);
  for (const e of errors.slice(0, 3)) console.log("   ", e.split("\n").slice(0, 4).join(" | "));
}
await browser.close();
