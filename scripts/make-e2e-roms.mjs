/**
 * Generates the fixture ROMs for scripts/e2e-rom-play.mjs into /tmp/roms:
 *
 *   arkanoid.gba               — GBA image with a valid header + a tiny
 *                                arm6-tumbler stub that flips palette colors
 *                                (so the emulator visibly "runs")
 *   Arkanoid Demo (USA).zip    — the same GBA image zip-wrapped, with the
 *                                "(USA)" tag to exercise region auto-fill
 *   wordle.nds                 — NDS image with a valid DS header (DeSmuME
 *                                boots it BIOS-free)
 *
 * These are synthetic homebrew images built here (no third-party ROMs), sized
 * and structured so EmulatorJS accepts them as real cartridges. The e2e checks
 * core boot, vault/cloud round-trips and TV navigation — not game content.
 *
 * Run: node scripts/make-e2e-roms.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const OUT = process.env.ROMS_DIR ?? "/tmp/roms";
mkdirSync(OUT, { recursive: true });

// ── GBA ─────────────────────────────────────────────────────────────────────

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function gbaRom() {
  const rom = Buffer.alloc(256 * 1024, 0);

  // Entry point: b 0x080000C0 (branch to the stub below).
  Buffer.from([0x06, 0x00, 0x00, 0xea]).copy(rom, 0);

  // Nintendo logo placeholder (0x9c bytes at 0x04) — emulators don't verify
  // it, real hardware does; fill with a recognizable pattern.
  for (let i = 0x04; i < 0xa0; i += 1) rom[i] = (i * 7) & 0xff;

  // Game title (12 bytes) + game code + maker code + fixed 0x96.
  rom.write("ARKANOIDDEMO", 0xa0, "ascii");
  rom.write("KDEE", 0xac, "ascii"); // game code
  rom.write("01", 0xb0, "ascii"); // maker code
  rom[0xb2] = 0x96;

  // Header checksum (0xbd) = -(0x19 + sum(0xa0..0xbc)) & 0xff.
  let sum = 0x19;
  for (let i = 0xa0; i <= 0xbc; i += 1) sum += rom[i];
  rom[0xbd] = (-sum) & 0xff;

  // A tiny thumb stub at 0xC0: writes to BG palette RAM in a loop so frames
  // change color (enough to prove the core is executing).
  const stub = [
    0x20, 0x40, // movs r0, #0x40
    0x01, 0x49, // ldr r1, [pc, #4]  (0x05000000 = BG palette)
    0x08, 0x70, // strb r0, [r1]
    0x01, 0x30, // adds r0, #1
    0xfc, 0xe7, // b -8
    0x00, 0x00, 0x00, 0x05, // .word 0x05000000
  ];
  Buffer.from(stub).copy(rom, 0xc0);

  return rom;
}

// ── NDS ────────────────────────────────────────────────────────────────────

function ndsRom() {
  const rom = Buffer.alloc(512 * 1024, 0);

  rom.write("WORDLE DEMO", 0x00, "ascii"); // game title (12)
  rom.write("KWLE", 0x0c, "ascii"); // game code
  rom.write("01", 0x10, "ascii"); // maker code
  rom[0x12] = 0x00; // unit code (NDS)
  rom[0x13] = 0x04; // encryption seed select
  rom[0x14] = 0x08; // device capacity (128KB << 8 = 32MB ceiling)
  rom[0x1e] = 0x04; // ROM version
  rom[0x1f] = 0x00; // autostart

  // ARM9 entry (0x20) / ARM7 entry (0x24): point at header + 0x4000.
  Buffer.from([0x00, 0x00, 0x40, 0x02]).copy(rom, 0x20);
  Buffer.from([0x00, 0x80, 0x40, 0x02]).copy(rom, 0x24);

  // Simple logo area filled with a pattern; DeSmuME does not verify the
  // DS banner logo for homebrew.
  for (let i = 0xc0; i < 0x15c; i += 1) rom[i] = (i * 13) & 0xff;

  // Header checksum (0x15e) = -(0x30 + sum(0x00..0x15c)) & 0xff.
  let sum = 0x30;
  for (let i = 0x00; i <= 0x15c; i += 1) sum += rom[i];
  rom[0x15e] = (-sum) & 0xff;

  // A trivial ARM9 "program": endless loop (the core boots, idle screen).
  Buffer.from([0xfe, 0xe7, 0x00, 0x00]).copy(rom, 0x4000);

  return rom;
}

// ── zip (stored entries, sizes in local headers) ───────────────────────────

function storedZip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const [name, data] of entries) {
    const nameBytes = Buffer.from(name, "utf8");
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags (sizes known)
    local.writeUInt16LE(0, 8); // method: stored
    local.writeUInt16LE(0, 10); // time
    local.writeUInt16LE(0x21, 12); // date (1980-01-01)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);

    chunks.push(local, nameBytes, data);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(0, 8);
    dir.writeUInt16LE(0, 10);
    dir.writeUInt16LE(0, 12);
    dir.writeUInt16LE(0x21, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(data.length, 20);
    dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(nameBytes.length, 28);
    dir.writeUInt16LE(0, 30);
    dir.writeUInt16LE(0, 32);
    dir.writeUInt16LE(0, 34);
    dir.writeUInt16LE(0, 36);
    dir.writeUInt32LE(0, 38);
    dir.writeUInt32LE(offset, 42);

    central.push(dir, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }

  const centralStart = offset;
  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(centralStart, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...chunks, centralBuf, eocd]);
}

// ── write fixtures ─────────────────────────────────────────────────────────

const gba = gbaRom();
const nds = ndsRom();
const zip = storedZip([["arkanoid.gba", gba]]);

const fixtures = [
  ["arkanoid.gba", gba],
  ["wordle.nds", nds],
  ["Arkanoid Demo (USA).zip", zip],
];
for (const [file, bytes] of fixtures) {
  writeFileSync(`${OUT}/${file}`, bytes);
  console.log(
    `${file}: ${bytes.length} bytes  sha1=${createHash("sha1").update(bytes).digest("hex").slice(0, 12)}…`,
  );
}
console.log("fixtures ready in", OUT);
