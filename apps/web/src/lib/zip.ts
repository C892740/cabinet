/**
 * Minimal ZIP reader for ROM archives — zero dependencies.
 *
 * No-Intro/GoodSets ROMs arrive as .zip files (the user's GBA/NDS libraries
 * included), and EmulatorJS's own archive handling is undocumented per system,
 * so Cabinet unwraps archives itself before handing bytes to the player.
 *
 * Supported: stored (0) and deflated (8) entries, any archive size, no zip64,
 * no encryption. Anything else throws a clear, user-facing error.
 *
 * Inflation uses the platform's DecompressionStream("deflate-raw") when it
 * exists (every modern browser + Node 18+) and falls back to a compact pure
 * DEFLATE decoder for older smart-TV browsers that lack the API.
 */

export class ZipError extends Error {}

/** ROM bytes are always backed by a plain ArrayBuffer (never SharedArrayBuffer),
 * so they are valid BlobParts for the player on every TypeScript version. */
export type RomBytes = Uint8Array & { buffer: ArrayBuffer };

export interface ZipEntry {
  name: string;
  /** 0 = stored, 8 = deflate. */
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  isDirectory: boolean;
  /** Offset of the entry's local file header inside the archive. */
  localOffset: number;
}

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/** Parse the central directory of a zip archive. */
export function listZipEntries(bytes: Uint8Array): ZipEntry[] {
  const view = viewOf(bytes);
  if (bytes.length < 22) throw new ZipError("file is too small to be a zip archive");

  // End-of-central-directory: scan backwards past the optional comment.
  let eocd = -1;
  const lowest = Math.max(0, bytes.length - 22 - 65535);
  for (let i = bytes.length - 22; i >= lowest; i -= 1) {
    if (
      view.getUint32(i, true) === EOCD_SIG &&
      i + 22 + view.getUint16(i + 20, true) === bytes.length
    ) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipError("not a zip archive (no end-of-central-directory record)");

  const total = view.getUint16(eocd + 10, true);
  const centralOffset = view.getUint32(eocd + 16, true);

  const entries: ZipEntry[] = [];
  let p = centralOffset;
  for (let i = 0; i < total; i += 1) {
    if (p + 46 > bytes.length || view.getUint32(p, true) !== CENTRAL_SIG) {
      throw new ZipError("corrupt zip central directory");
    }
    const flags = view.getUint16(p + 8, true);
    const method = view.getUint16(p + 10, true);
    const compressedSize = view.getUint32(p + 20, true);
    const uncompressedSize = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = new TextDecoder("latin1").decode(bytes.subarray(p + 46, p + 46 + nameLen));

    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw new ZipError(`"${name}" uses zip64 — re-zip the ROM without zip64`);
    }
    if (flags & 0x0001) {
      throw new ZipError(`"${name}" is encrypted — re-zip the ROM without a password`);
    }
    if (method !== 0 && method !== 8) {
      throw new ZipError(`"${name}" uses unsupported compression method ${method}`);
    }

    entries.push({
      name,
      method,
      compressedSize,
      uncompressedSize,
      isDirectory: name.endsWith("/"),
      localOffset,
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** Extract one entry's bytes (stored copy or raw-DEFLATE inflate). */
export async function extractZipEntry(bytes: Uint8Array, entry: ZipEntry): Promise<RomBytes> {
  const view = viewOf(bytes);
  const local = entry.localOffset;
  if (local + 30 > bytes.length || view.getUint32(local, true) !== LOCAL_SIG) {
    throw new ZipError(`corrupt zip entry "${entry.name}"`);
  }
  const nameLen = view.getUint16(local + 26, true);
  const extraLen = view.getUint16(local + 28, true);
  const start = local + 30 + nameLen + extraLen;
  if (start + entry.compressedSize > bytes.length) {
    throw new ZipError(`truncated zip entry "${entry.name}"`);
  }
  const raw = bytes.subarray(start, start + entry.compressedSize);

  if (entry.method === 0) return raw.slice();
  const out = await inflateRaw(raw, entry.uncompressedSize);
  if (out.length !== entry.uncompressedSize) {
    throw new ZipError(`"${entry.name}" decompressed to an unexpected size`);
  }
  return out;
}

// ─── raw DEFLATE ────────────────────────────────────────────────────────────

type ByteTransform = new (format: string) => {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
};

async function inflateViaPlatform(raw: Uint8Array): Promise<RomBytes | null> {
  const Ds = (globalThis as Record<string, unknown>).DecompressionStream as
    | ByteTransform
    | undefined;
  if (!Ds) return null;
  try {
    const transform = new Ds("deflate-raw");
    // Start draining the readable side before writing: TransformStream's
    // writable won't resolve a write until the transformed output is read.
    const output = new Response(transform.readable).arrayBuffer();
    const writer = transform.writable.getWriter();
    await writer.write(raw);
    await writer.close();
    return new Uint8Array(await output);
  } catch {
    return null;
  }
}

/** Inflate a raw DEFLATE stream, preferring the platform implementation. */
export async function inflateRaw(raw: Uint8Array, expectedSize = 0): Promise<RomBytes> {
  const fast = await inflateViaPlatform(raw);
  return fast ?? inflateRawPure(raw, expectedSize);
}

const LENGTH_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131,
  163, 195, 227, 258,
];
const LENGTH_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
];
const DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049,
  3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const DIST_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
];
const CLCL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

class BitReader {
  private pos = 0;
  private bit = 0;

  constructor(private readonly data: Uint8Array) {}

  bits(count: number): number {
    let value = 0;
    for (let i = 0; i < count; i += 1) {
      if (this.pos >= this.data.length) throw new ZipError("unexpected end of deflate stream");
      value |= ((this.data[this.pos] >> this.bit) & 1) << i;
      this.bit += 1;
      if (this.bit === 8) {
        this.bit = 0;
        this.pos += 1;
      }
    }
    return value;
  }

  align(): void {
    if (this.bit) {
      this.bit = 0;
      this.pos += 1;
    }
  }

  bytes(length: number): Uint8Array {
    this.align();
    if (this.pos + length > this.data.length) throw new ZipError("unexpected end of deflate stream");
    const out = this.data.subarray(this.pos, this.pos + length);
    this.pos += length;
    return out;
  }
}

interface Huffman {
  counts: number[];
  symbols: number[];
}

function buildHuffman(lengths: number[]): Huffman {
  const counts = new Array<number>(16).fill(0);
  for (const length of lengths) counts[length] += 1;
  counts[0] = 0;
  const offsets = new Array<number>(16).fill(0);
  for (let i = 1; i < 16; i += 1) offsets[i] = offsets[i - 1] + counts[i - 1];
  const symbols = new Array<number>(lengths.length).fill(0);
  for (let symbol = 0; symbol < lengths.length; symbol += 1) {
    const length = lengths[symbol];
    if (length > 0) symbols[offsets[length]++] = symbol;
  }
  return { counts, symbols };
}

function decodeSymbol(reader: BitReader, huff: Huffman): number {
  let code = 0;
  let first = 0;
  let index = 0;
  for (let length = 1; length < 16; length += 1) {
    code |= reader.bits(1);
    const count = huff.counts[length];
    if (code - first < count) return huff.symbols[index + (code - first)];
    index += count;
    first = (first + count) << 1;
    code <<= 1;
  }
  throw new ZipError("invalid deflate huffman code");
}

/** Pure-JS raw DEFLATE decoder — used where DecompressionStream is missing. */
export function inflateRawPure(data: Uint8Array, expectedSize = 0): RomBytes {
  const reader = new BitReader(data);
  let out = new Uint8Array(Math.max(expectedSize, 65536, 64));
  let outLen = 0;

  const ensure = (extra: number) => {
    if (outLen + extra <= out.length) return;
    let size = out.length;
    while (size < outLen + extra) size *= 2;
    const grown = new Uint8Array(size);
    grown.set(out.subarray(0, outLen));
    out = grown;
  };

  for (;;) {
    const isFinal = reader.bits(1);
    const type = reader.bits(2);

    if (type === 0) {
      const length = reader.bits(16);
      reader.bits(16); // NLEN — validated by the copy length check
      ensure(length);
      out.set(reader.bytes(length), outLen);
      outLen += length;
    } else if (type === 1 || type === 2) {
      let litlen: Huffman;
      let dist: Huffman;

      if (type === 1) {
        const lengths = new Array<number>(288).fill(8);
        lengths.fill(9, 144, 256);
        lengths.fill(7, 256, 280);
        lengths.fill(8, 280, 288);
        litlen = buildHuffman(lengths);
        dist = buildHuffman(new Array<number>(30).fill(5));
      } else {
        const hlit = reader.bits(5) + 257;
        const hdist = reader.bits(5) + 1;
        const hclen = reader.bits(4) + 4;
        const codeLengthLengths = new Array<number>(19).fill(0);
        for (let i = 0; i < hclen; i += 1) {
          codeLengthLengths[CLCL_ORDER[i]] = reader.bits(3);
        }
        const codeLengths = buildHuffman(codeLengthLengths);
        const lengths = new Array<number>(hlit + hdist).fill(0);
        let i = 0;
        while (i < lengths.length) {
          const symbol = decodeSymbol(reader, codeLengths);
          if (symbol < 16) {
            lengths[i++] = symbol;
          } else if (symbol === 16) {
            if (i === 0) throw new ZipError("invalid deflate code lengths");
            const previous = lengths[i - 1];
            let repeat = 3 + reader.bits(2);
            while (repeat-- > 0 && i < lengths.length) lengths[i++] = previous;
          } else if (symbol === 17) {
            let repeat = 3 + reader.bits(3);
            while (repeat-- > 0 && i < lengths.length) lengths[i++] = 0;
          } else {
            let repeat = 11 + reader.bits(7);
            while (repeat-- > 0 && i < lengths.length) lengths[i++] = 0;
          }
        }
        litlen = buildHuffman(lengths.slice(0, hlit));
        dist = buildHuffman(lengths.slice(hlit));
      }

      for (;;) {
        const symbol = decodeSymbol(reader, litlen);
        if (symbol < 256) {
          ensure(1);
          out[outLen++] = symbol;
          continue;
        }
        if (symbol === 256) break;

        const lengthIndex = symbol - 257;
        if (lengthIndex >= LENGTH_BASE.length) throw new ZipError("invalid deflate length code");
        const length = LENGTH_BASE[lengthIndex] + reader.bits(LENGTH_EXTRA[lengthIndex]);

        const distanceSymbol = decodeSymbol(reader, dist);
        if (distanceSymbol >= DIST_BASE.length) throw new ZipError("invalid deflate distance code");
        const distance = DIST_BASE[distanceSymbol] + reader.bits(DIST_EXTRA[distanceSymbol]);
        if (distance > outLen) throw new ZipError("invalid deflate back-reference");

        ensure(length);
        for (let k = 0; k < length; k += 1) {
          out[outLen + k] = out[outLen - distance + k];
        }
        outLen += length;
      }
    } else {
      throw new ZipError("invalid deflate block type");
    }

    if (isFinal) break;
  }

  return out.slice(0, outLen);
}

// ─── ROM archive helpers ────────────────────────────────────────────────────

/** Extensions we recognise as playable ROM images inside an archive. */
export const ROM_EXTENSIONS = [
  "nes", "fds", "unf", "unif",
  "sfc", "smc", "fig", "swc", "bs",
  "gb", "gbc", "dmg",
  "gba", "agb",
  "n64", "z64", "v64", "u64",
  "gen", "md", "smd",
  "gg", "sms",
  "bin", "cue", "img", "mdf", "pbp", "chd", "iso",
  "nds",
  "a26",
];

function extensionOf(name: string): string {
  const base = name.split("/").pop() ?? name;
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
}

/** Pick the playable ROM entry out of an archive listing. */
export function findRomEntry(entries: ZipEntry[]): ZipEntry | null {
  const files = entries.filter(
    (entry) =>
      !entry.isDirectory &&
      !entry.name.startsWith("__MACOSX/") &&
      !entry.name.split("/").pop()!.startsWith("."),
  );
  const roms = files.filter((entry) => ROM_EXTENSIONS.includes(extensionOf(entry.name)));
  if (roms.length > 0) return roms[0]!;
  // A single-file archive with an unknown extension: still worth trying.
  if (files.length === 1) return files[0]!;
  return null;
}

export interface UnwrappedRom {
  /** Name to show / save — the inner ROM name when the input was an archive. */
  fileName: string;
  bytes: RomBytes;
  fromZip: boolean;
}

/**
 * Unwrap a picked ROM file. .zip archives are extracted to their ROM image;
 * anything else passes through untouched.
 */
export async function unwrapRomFile(fileName: string, bytes: RomBytes): Promise<UnwrappedRom> {
  if (!fileName.toLowerCase().endsWith(".zip")) return { fileName, bytes, fromZip: false };
  const entries = listZipEntries(bytes);
  const entry = findRomEntry(entries);
  if (!entry) {
    throw new ZipError(
      "no ROM file found inside the zip — expected .gba, .nds or another supported ROM image",
    );
  }
  return {
    fileName: entry.name.split("/").pop() ?? entry.name,
    bytes: await extractZipEntry(bytes, entry),
    fromZip: true,
  };
}
