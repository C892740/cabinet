/**
 * E2E: "add a ROM to the library → play it" for GBA and NDS.
 *
 * Run with the dev server on :3000:
 *   node scripts/e2e-rom-play.mjs
 *
 * Uses freely distributable homebrew ROMs (not commercial dumps):
 *   • /tmp/roms/Arkanoid Demo (USA).zip  → zip-wrapped GBA homebrew
 *   • /tmp/roms/wordle.nds               → raw NDS homebrew (Wordle DS, GPL/CC0)
 */

import pw from "playwright";
import fs from "node:fs";
import crypto from "node:crypto";

const BASE = "http://127.0.0.1:3000";
const GBA_ZIP = "/tmp/roms/Arkanoid Demo (USA).zip";
const GBA_RAW = "/tmp/roms/arkanoid.gba";
const NDS_RAW = "/tmp/roms/wordle.nds";

const failures = [];
const log = (...args) => console.log("[e2e]", ...args);
const check = (name, ok, detail = "") => {
  log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(name);
};

const sha1 = (buf) => crypto.createHash("sha1").update(buf).digest("hex");

/** The EmulatorJS frame; `window.EJS_emulator` inside it is the boot signal. */
async function waitForEjsFrame(page) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const frame = page.frames().find((candidate) => candidate.url().includes("/play/frame"));
    if (frame) return frame;
    await page.waitForTimeout(500);
  }
  throw new Error("play frame never appeared");
}

const browser = await pw.chromium.launch({ args: ["--no-sandbox", "--disable-gpu"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(60_000);

const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(String(error)));

// ── 1. sign in (session cookie shared with page.request) ────────────────────
{
  const response = await page.request.post(`${BASE}/api/auth/register`, {
    data: {
      // Unique per run: re-registering the same email fails and drops the session.
      email: `e2e-player-${Date.now()}@cabinet.local`,
      displayName: "E2E Player",
      password: "password123",
    },
  });
  const body = await response.json();
  check("register session", response.ok() && body.ok, body.error ?? body.user?.email ?? "");
}

// ── 2. add the zipped GBA homebrew through the library UI ───────────────────
async function addGameThroughUi(file, expectedTitleFragment) {
  await page.goto(`${BASE}/library`, { waitUntil: "domcontentloaded" });
  // The click can land before React hydration on a warm dev server — retry once.
  const addButton = page.getByRole("button", { name: "+ Add game" });
  await addButton.waitFor();
  await page.waitForTimeout(600);
  await addButton.click();
  // The picker input is hidden by design — wait for attachment, not visibility.
  const fileInputReady = await page
    .waitForSelector('input[type="file"]', { state: "attached", timeout: 10_000 })
    .catch(() => null);
  if (!fileInputReady) {
    await addButton.click();
    await page.waitForSelector('input[type="file"]', { state: "attached", timeout: 15_000 });
  }
  await page.setInputFiles('input[type="file"]', file);
  await page.waitForSelector("text=ready", { timeout: 30_000 });
  const title = await page.inputValue('input[placeholder="e.g. Super Metroid"]');
  const platform = await page.getByLabel("Platform").inputValue();
  check(
    `auto-fill from ${file.split("/").pop()}`,
    title.toLowerCase().includes(expectedTitleFragment.toLowerCase()),
    `title="${title}" platform=${platform}`,
  );
  const before = new Set(
    (await (await page.request.get(`${BASE}/api/roms`)).json()).roms.map((rom) => rom.id),
  );
  await page.getByRole("button", { name: "Add game", exact: true }).click();
  // The insert is async and earlier runs leave same-titled cards on the page —
  // wait for the server to report a brand-new rom id instead of matching DOM.
  let created = null;
  for (let attempt = 0; attempt < 30 && !created; attempt += 1) {
    await page.waitForTimeout(1000);
    const list = await (
      await page.request.get(`${BASE}/api/roms?q=${encodeURIComponent(expectedTitleFragment)}`)
    ).json();
    created = list.roms.find(
      (rom) =>
        !before.has(rom.id) &&
        rom.title.toLowerCase().includes(expectedTitleFragment.toLowerCase()),
    );
  }
  check(`rom created for ${expectedTitleFragment}`, Boolean(created), created?.id ?? "never appeared");
  return created;
}

const gbaRom = await addGameThroughUi(GBA_ZIP, "arkanoid");
check("gba rom created", Boolean(gbaRom?.id), gbaRom?.id ?? "missing");
check("platform detected as gba", gbaRom?.platformSlug === "gba", gbaRom?.platformSlug ?? "");

// ── 3. play page auto-boots from the vault (no file re-pick) ────────────────
{
  await page.goto(`${BASE}/play?rom=${gbaRom.id}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Loaded from this device's ROM vault", { timeout: 30_000 });
  const iframe = await page.waitForSelector('iframe[src*="/play/frame"]', { timeout: 30_000 });
  check("auto-boot from vault (no file picker)", Boolean(iframe));
  const src = await iframe.getAttribute("src");
  check("frame uses gba core", src.includes("core=gba"), src.slice(0, 120));

  // Core assets stream from the EmulatorJS CDN — allow a generous boot window.
  const ejsFrame = await waitForEjsFrame(page);
  const booted = await ejsFrame
    .waitForFunction(() => Boolean(window.EJS_emulator), undefined, { timeout: 240_000 })
    .then(() => true)
    .catch(() => false);
  check("EmulatorJS booted (core running)", booted);
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "artifacts/e2e-gba-play.png" });
  log("screenshot: artifacts/e2e-gba-play.png");
}

// ── 4. the account copy streams back byte-exact (this is the TV path) ───────
{
  let meta = null;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await page.request.get(`${BASE}/api/roms/${gbaRom.id}/rom?meta=1`);
    const body = await response.json();
    meta = body.meta ?? null;
    if (meta) break;
    await page.waitForTimeout(1000);
  }
  check("cloud rom meta synced", Boolean(meta), meta ? `${meta.fileName} ${meta.sizeBytes}B` : "never appeared");

  const download = await page.request.get(`${BASE}/api/roms/${gbaRom.id}/rom`);
  const streamed = await download.body();
  const original = fs.readFileSync(GBA_RAW);
  check("streamed bytes match the ROM", sha1(streamed) === sha1(original), `streamed=${streamed.length}B original=${original.length}B`);
}

// ── 5. NDS flow: raw .nds, boots the BIOS-free DeSmuME core ────────────────
const ndsRom = await addGameThroughUi(NDS_RAW, "wordle");
check("nds rom created", Boolean(ndsRom?.id), ndsRom?.id ?? "missing");
check("platform detected as nds", ndsRom?.platformSlug === "nds", ndsRom?.platformSlug ?? "");

{
  await page.goto(`${BASE}/play?rom=${ndsRom.id}`, { waitUntil: "domcontentloaded" });
  const iframe = await page.waitForSelector('iframe[src*="/play/frame"]', { timeout: 30_000 });
  const src = await iframe.getAttribute("src");
  check("frame boots desmume (no BIOS needed)", src.includes("core=desmume"), src.slice(0, 120));

  const ejsFrame = await waitForEjsFrame(page);
  const booted = await ejsFrame
    .waitForFunction(() => Boolean(window.EJS_emulator), undefined, { timeout: 240_000 })
    .then(() => true)
    .catch(() => null);
  check("NDS emulator booted (core running)", Boolean(booted));
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "artifacts/e2e-nds-play.png" });
  log("screenshot: artifacts/e2e-nds-play.png");
}

// ── 6. TV mode: nav map with PS5 glyphs + working Play button ───────────────
{
  await page.goto(`${BASE}/tv`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Up to four controllers", { timeout: 30_000 });
  check("gamepad nav map rendered", true);
  await page.screenshot({ path: "artifacts/e2e-tv-navmap.png" });

  await page.locator('button:has-text("arkanoid")').first().click();
  const playLink = await page.waitForSelector('a[data-tv-autofocus]', { timeout: 15_000 });
  const href = await playLink.getAttribute("href");
  check("TV panel Play links to the player", href.includes("/play?rom=") && href.includes("source=tv"), href ?? "");
  await page.screenshot({ path: "artifacts/e2e-tv-panel.png" });
  log("screenshot: artifacts/e2e-tv-panel.png");
}

log("console errors:", consoleErrors.length ? consoleErrors.slice(0, 10) : "none");
await browser.close();

if (failures.length > 0) {
  console.error(`E2E FAILED: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("E2E PASSED");
