/**
 * Cloud ROM sync — chunked storage for library ROM files.
 *
 * Big ROMs (a trimmed NDS dump is tens of MB) can't ride a single serverless
 * request, so uploads go up as base64 chunks and stream back as one binary
 * response. The player passes that URL straight to EmulatorJS, which is how
 * devices without a filesystem — the TV app first of all — get the game.
 *
 * Everything here is safe to import from both client components and API
 * routes (fetch + base64 only), so the wire contract lives in one place.
 */

/** Decoded bytes per upload request (stays under serverless body limits). */
export const ROM_CHUNK_BYTES = 2_000_000;

/** Largest ROM Cabinet will sync. PS1/arcade images beyond this stay local. */
export const MAX_ROM_BYTES = 256 * 1024 * 1024;

export interface RomBlobMeta {
  romId: string;
  fileName: string;
  sizeBytes: number;
  chunkSize: number;
  totalChunks: number;
  updatedAt: string;
}

export class RomSyncError extends Error {}

export function romBlobUrl(romId: string): string {
  return `/api/roms/${romId}/rom`;
}

// ─── base64 (chunk-sized payloads) ──────────────────────────────────────────

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + step, bytes.length)));
  }
  return btoa(binary);
}

export function base64ToBytes(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ─── client-side helpers ────────────────────────────────────────────────────

/** Metadata for the ROM synced to the account, or null when none exists. */
export async function fetchRomBlobMeta(romId: string): Promise<RomBlobMeta | null> {
  const response = await fetch(`${romBlobUrl(romId)}?meta=1`);
  if (response.status === 401) throw new RomSyncError("sign-in required");
  if (!response.ok) return null;
  const data = (await response.json().catch(() => null)) as { ok?: boolean; meta?: RomBlobMeta };
  return data?.ok && data.meta ? data.meta : null;
}

/**
 * Upload ROM bytes to the account in chunks. Sequential on purpose: it keeps
 * big uploads gentle on serverless functions and makes progress reporting
 * honest.
 */
export async function uploadRomBlob(
  romId: string,
  fileName: string,
  bytes: Uint8Array,
  onProgress?: (fraction: number) => void,
): Promise<RomBlobMeta> {
  if (bytes.length > MAX_ROM_BYTES) {
    throw new RomSyncError(
      `this ROM is larger than ${Math.round(MAX_ROM_BYTES / 1024 / 1024)} MB — it plays from this device only`,
    );
  }
  const totalChunks = Math.max(1, Math.ceil(bytes.length / ROM_CHUNK_BYTES));
  for (let index = 0; index < totalChunks; index += 1) {
    const start = index * ROM_CHUNK_BYTES;
    const slice = bytes.subarray(start, Math.min(start + ROM_CHUNK_BYTES, bytes.length));
    const response = await fetch(romBlobUrl(romId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        index,
        total: totalChunks,
        fileName,
        sizeBytes: bytes.length,
        chunkSize: ROM_CHUNK_BYTES,
        data: bytesToBase64(slice),
      }),
    });
    const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string };
    if (!response.ok || !data?.ok) {
      throw new RomSyncError(data?.error ?? `upload failed (HTTP ${response.status})`);
    }
    onProgress?.((index + 1) / totalChunks);
  }
  return {
    romId,
    fileName,
    sizeBytes: bytes.length,
    chunkSize: ROM_CHUNK_BYTES,
    totalChunks,
    updatedAt: new Date().toISOString(),
  };
}

export async function deleteRomBlob(romId: string): Promise<void> {
  await fetch(romBlobUrl(romId), { method: "DELETE" });
}
