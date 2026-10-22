/**
 * Generate the Cabinet Tizen app icon (512×512 PNG).
 *
 * The mark is the Cabinet logo idea in pixels: the letter "C" drawn as the
 * universal power symbol — a ring open at the top with a stem through the gap.
 * No image dependencies: raw RGBA → PNG chunks → zlib deflate.
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SIZE = 512;

// ── draw ────────────────────────────────────────────────────────────────────

const pixels = Buffer.alloc(SIZE * SIZE * 4);

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    const i = (y * SIZE + x) * 4;

    // Background: deep ink with a soft violet glow top-right.
    const glow = smoothstep(SIZE * 1.1, SIZE * 0.1, Math.hypot(x - SIZE, y)) * 0.22;
    let r = 11 + 60 * glow;
    let g = 11 + 30 * glow;
    let b = 19 + 90 * glow;

    // Power-symbol C: ring with a top gap + stem through the gap.
    const cx = SIZE / 2;
    const cy = SIZE / 2 + 18;
    const dist = Math.hypot(x - cx, y - cy);
    const ringRadius = 150;
    const ringThickness = 27;
    const ring = 1 - smoothstep(ringThickness - 2, ringThickness + 2, Math.abs(dist - ringRadius));

    // Top gap: everything above cy - 96 near the vertical axis is cut away.
    const aboveGap = y < cy - 92 && Math.abs(x - cx) < 60 ? 0 : 1;

    // Stem: vertical bar from the ring gap down to the center.
    const stemHalfWidth = 15;
    const stem =
      Math.abs(x - cx) < stemHalfWidth && y < cy - 30 && y > cy - 210
        ? 1 - smoothstep(stemHalfWidth - 1.5, stemHalfWidth + 1.5, Math.abs(x - cx))
        : 0;

    const mark = Math.max(ring * aboveGap, stem);
    if (mark > 0) {
      // Violet → fuchsia gradient across the mark.
      const t = y / SIZE;
      const mr = 99 + (217 - 99) * t;
      const mg = 102 + (70 - 102) * t;
      const mb = 241 + (239 - 241) * t;
      r = r * (1 - mark) + mr * mark;
      g = g * (1 - mark) + mg * mark;
      b = b * (1 - mark) + mb * mark;
    }

    pixels[i] = Math.round(r);
    pixels[i + 1] = Math.round(g);
    pixels[i + 2] = Math.round(b);
    pixels[i + 3] = 255;
  }
}

// ── encode PNG ──────────────────────────────────────────────────────────────

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y += 1) {
  raw[y * (SIZE * 4 + 1)] = 0; // filter: none
  pixels.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]);

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "apps", "tizen");
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "icon.png"), png);
console.log(`wrote ${path.join(outDir, "icon.png")} (${png.length} bytes)`);
