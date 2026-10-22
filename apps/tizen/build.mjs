/**
 * Builds the Cabinet TV Tizen widget (`.wgt`) — a plain ZIP with a strict layout.
 *
 *   node apps/tizen/build.mjs [--url https://your-deployment.vercel.app/tv]
 *
 * Output: apps/tizen/release/Cabinet-TV-<version>.wgt  (unsigned — see README.md
 * for the one signing step that requires Tizen Studio + a Samsung account.)
 *
 * The deployment URL is substituted into the *staged copies* only — the checked
 * in config.xml/index.html keep their example URL and re-runs are idempotent.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

function arg(name, fallback) {
  const flagIndex = process.argv.indexOf(`--${name}`);
  if (flagIndex !== -1 && process.argv[flagIndex + 1]) return process.argv[flagIndex + 1];
  return fallback;
}

const url = arg("url", process.env.CABINET_TV_URL ?? "https://cabinet-eta-gilt.vercel.app/tv");
const origin = new URL(url).origin;
const { version } = JSON.parse(readFileSync(path.join(here, "package.json"), "utf8"));

// The deployment URL baked into the checked-in sources. Substitution is
// two-step (full URL, then bare host) so iframe sources, <access> origins and
// the allow-navigation host list all end up pointing at the same deployment.
const SOURCE_URL = "https://cabinet-eta-gilt.vercel.app/tv";
const sourceHost = new URL(SOURCE_URL).host;
const targetHost = new URL(url).host;

// 1) Stage exactly what the widget contains, baking in the deployment URL.
const stage = path.join(here, "release", "stage");
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

for (const file of ["config.xml", "index.html"]) {
  const templated = readFileSync(path.join(here, file), "utf8")
    .replaceAll(SOURCE_URL, url)
    .replaceAll(sourceHost, targetHost)
    .replaceAll("https://*.vercel.app", origin);
  writeFileSync(path.join(stage, file), templated);
}

const icon = path.join(here, "icon.png");
if (!existsSync(icon)) {
  console.error("missing icon.png — run: node apps/tizen/make-icon.mjs");
  process.exit(1);
}
copyFileSync(icon, path.join(stage, "icon.png"));

// 2) Zip it (config.xml must sit at the archive root).
const out = path.join(here, "release", `Cabinet-TV-${version}.wgt`);
rmSync(out, { force: true });
execFileSync("zip", ["-q", "-j", out, "config.xml", "index.html", "icon.png"], { cwd: stage });

console.log(`✔ ${out}`);
console.log(`  start URL: ${url}`);
console.log("  NOTE: unsigned. Sign with `tizen package -t wgt -s <cert-profile>` (see README.md).");
