/**
 * Client-side file hashing for ROM scanning.
 *
 * ScreenScraper identifies ROMs by CRC32/SHA1 + filename. Hashes are computed
 * in the browser (WebCrypto + a small CRC32 table) so ROM bytes never leave
 * the machine — only the manifest goes to the server for matching.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): string {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

export async function sha1Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", bytes as unknown as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export interface FileHashes {
  fileName: string;
  sizeBytes: number;
  crc32: string;
  sha1: string;
}

/** Hash one picked file (reads up to 64 MB — retro ROMs are small). */
export async function hashFile(file: File): Promise<FileHashes> {
  const buffer = await file.slice(0, 64 * 1024 * 1024).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  return {
    fileName: file.name,
    sizeBytes: file.size,
    crc32: crc32(bytes),
    sha1: await sha1Hex(bytes),
  };
}
