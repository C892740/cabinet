/**
 * Generates icon.png (512×512) for the Tizen widget — pure Node, no deps.
 *
 *   node apps/tizen/make-icon.mjs
 *
 * A rounded-square with the Cabinet accent gradient and a soft highlight.
 */

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SIZE = 512;
const RADIUS = 96;

// CRC32 for PNG chunks
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// Accent gradient stops (#6366f1 → #8b5cf6 → #d946ef), as in globals.css.
const STOPS = [
  [0.0, [0x63, 0x66, 0xf1]],
  [0.42, [0x8b, 0x5c, 0xf6]],
  [1.0, [0xd9, 0x46, 0xef]],
];
function gradient(t) {
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      const [t0, c0] = STOPS[i - 1];
      const [t1, c1] = STOPS[i];
      const k = (t - t0) / (t1 - t0);
      return c0.map((v, j) => Math.round(v + (c1[j] - v) * k));
    }
  }
  return STOPS[STOPS.length - 1][1];
}

function roundedAlpha(x, y) {
  // Signed distance to a rounded square centred on the canvas.
  const half = SIZE / 2 - 2;
  const dx = Math.abs(x - SIZE / 2) - (half - RADIUS);
  const dy = Math.abs(y - SIZE / 2) - (half - RADIUS);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  const inside = Math.min(Math.max(dx, dy), 0);
  const dist = outside + inside - RADIUS;
  return Math.max(0, Math.min(1, 0.5 - dist)); // ~1.5px antialiased edge
}

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  const row = y * (SIZE * 4 + 1);
  raw[row] = 0; // filter: none
  for (let x = 0; x < SIZE; x++) {
    const [r, g, b] = gradient(y / (SIZE - 1));
    // soft highlight toward the top-left
    const hl = Math.max(0, 1 - Math.hypot(x / SIZE - 0.32, y / SIZE - 0.28) * 1.9) * 0.22;
    const mix = (v) => Math.round(v + (255 - v) * hl);
    const o = row + 1 + x * 4;
    raw[o] = mix(r);
    raw[o + 1] = mix(g);
    raw[o + 2] = mix(b);
    raw[o + 3] = Math.round(255 * roundedAlpha(x, y));
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "icon.png");
writeFileSync(out, png);
console.log(`✔ ${out} (${png.length} bytes)`);
