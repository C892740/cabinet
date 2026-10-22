/**
 * Self-test for apps/web/src/lib/zip.ts (run with `npx tsx scripts/zip-selftest.ts`).
 *
 * Builds real zip archives (stored + raw-DEFLATE entries, multi-entry with
 * junk) and asserts the reader extracts them byte-exact — including the pure
 * JS inflate fallback that older smart-TV browsers rely on.
 */

import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import {
  extractZipEntry,
  findRomEntry,
  inflateRaw,
  inflateRawPure,
  listZipEntries,
  unwrapRomFile,
} from "../apps/web/src/lib/zip.ts";

// ── tiny zip writer (local headers + central directory + EOCD) ──────────────
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipSpec {
  name: string;
  data: Buffer;
  method: 0 | 8;
}

function makeZip(entries: ZipSpec[]): Buffer {
  const parts: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, "latin1");
    const comp = entry.method === 8 ? deflateRawSync(entry.data) : entry.data;
    const crc = crc32(entry.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(entry.method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, nameBytes, comp);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(entry.method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comp.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);

    offset += 30 + nameBytes.length + comp.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, centralBuf, eocd]);
}

// ── test payloads ───────────────────────────────────────────────────────────
const random64k = Buffer.from(
  Array.from({ length: 65536 }, (_, i) => (Math.imul(i, 2654435761) >>> 16) & 0xff),
);
const repetitive = Buffer.alloc(65536, 0x41);
for (let i = 0; i < repetitive.length; i += 97) repetitive[i] = 0x42;
const texty = Buffer.from("Pokemon FireRed (USA) gba rom padding ".repeat(2048));
const gbaLike = Buffer.concat([Buffer.from("GBA-HEADER-FAKE"), random64k.subarray(0, 30000)]);
const ndsLike = Buffer.concat([Buffer.from("NDS-HEADER-FAKE"), repetitive.subarray(0, 50000)]);

// 1. stored + deflated entries round-trip through list/extract
{
  const zip = makeZip([
    { name: "Pokemon - FireRed Version (USA).gba", data: gbaLike, method: 8 },
    { name: "readme.txt", data: texty, method: 0 },
  ]);
  const entries = listZipEntries(new Uint8Array(zip));
  assert.equal(entries.length, 2);
  assert.equal(entries[0]!.method, 8);
  assert.equal(entries[1]!.method, 0);
  const out = await extractZipEntry(new Uint8Array(zip), entries[0]!);
  assert.deepEqual(Buffer.from(out), gbaLike);
  const out2 = await extractZipEntry(new Uint8Array(zip), entries[1]!);
  assert.deepEqual(Buffer.from(out2), texty);
  console.log("ok: stored + deflated extraction");
}

// 2. pure-JS inflate fallback matches zlib on dynamic + fixed huffman payloads
for (const [label, payload] of [
  ["random", random64k],
  ["repetitive", repetitive],
  ["text", texty],
] as const) {
  const comp = deflateRawSync(payload, { level: 6 });
  const viaPure = inflateRawPure(new Uint8Array(comp), payload.length);
  assert.deepEqual(Buffer.from(viaPure), payload, `pure inflate mismatch (${label})`);
  const viaAuto = await inflateRaw(new Uint8Array(comp), payload.length);
  assert.deepEqual(Buffer.from(viaAuto), payload, `auto inflate mismatch (${label})`);
}
console.log("ok: pure-JS + auto inflate agree with zlib on dynamic/fixed huffman");

// 3. findRomEntry skips junk and picks the ROM; unwrap handles nested folders
{
  const zip = makeZip([
    { name: "__MACOSX/._Pokemon Diamond.nds", data: Buffer.from("junk"), method: 0 },
    { name: "Pokemon Diamond.nds", data: ndsLike, method: 8 },
    { name: "docs/manual.txt", data: texty, method: 8 },
  ]);
  const entries = listZipEntries(new Uint8Array(zip));
  const picked = findRomEntry(entries);
  assert.equal(picked?.name, "Pokemon Diamond.nds");
  const unwrapped = await unwrapRomFile("Pokemon Diamond.zip", new Uint8Array(zip));
  assert.equal(unwrapped.fromZip, true);
  assert.equal(unwrapped.fileName, "Pokemon Diamond.nds");
  assert.deepEqual(Buffer.from(unwrapped.bytes), ndsLike);
  console.log("ok: rom entry picked from multi-entry archive, unwrapped bytes match");
}

// 4. raw .gba passes through untouched
{
  const passthrough = await unwrapRomFile("FireRed.gba", new Uint8Array(gbaLike));
  assert.equal(passthrough.fromZip, false);
  assert.deepEqual(Buffer.from(passthrough.bytes), gbaLike);
  console.log("ok: raw ROM passthrough");
}

// 5. non-zip input produces a clear error
{
  assert.throws(
    () => listZipEntries(new Uint8Array(Buffer.from("not a zip at all, just plain garbage ".repeat(4)))),
    /not a zip/,
  );
  const goodZip = makeZip([{ name: "a.gba", data: gbaLike, method: 8 }]);
  assert.throws(
    () => listZipEntries(new Uint8Array(goodZip.subarray(0, 20))),
    /too small|not a zip/,
  );
  console.log("ok: clear errors for non-zip input");
}

console.log("ALL ZIP TESTS PASSED");
