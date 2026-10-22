/**
 * Local ROM vault — browser-side ROM storage (IndexedDB).
 *
 * Cabinet ships no games: the user attaches their own ROM once and the bytes
 * are kept in this device's browser so "Add game" → Play works instantly on
 * every later session (and offline). Cloud ROM sync (lib/rom-sync.ts) mirrors
 * the same bytes to the account so other devices — the TV included — can
 * stream them.
 *
 * Vault failures are never fatal: a private window or a TV browser with a tiny
 * storage quota simply falls back to re-attaching or streaming.
 */

import { unwrapRomFile, ZipError, type RomBytes } from "./zip";

const DB_NAME = "cabinet-rom-vault";
const STORE = "roms";
const DB_VERSION = 1;

export interface VaultRom {
  romId: string;
  fileName: string;
  bytes: RomBytes;
  sizeBytes: number;
  updatedAt: string;
}

interface StoredRom {
  romId: string;
  fileName: string;
  bytes: ArrayBuffer;
  sizeBytes: number;
  updatedAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "romId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("could not open the ROM vault"));
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = run(tx.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("ROM vault request failed"));
        tx.oncomplete = () => db.close();
      }),
  );
}

export function vaultAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

export async function saveRomToVault(
  romId: string,
  fileName: string,
  bytes: RomBytes,
): Promise<void> {
  if (!vaultAvailable()) return;
  const record: StoredRom = {
    romId,
    fileName,
    // Store a plain ArrayBuffer copy — structured-clone friendly.
    bytes: bytes.slice().buffer,
    sizeBytes: bytes.length,
    updatedAt: new Date().toISOString(),
  };
  await withStore("readwrite", (store) => store.put(record) as IDBRequest<IDBValidKey>);
}

export async function loadRomFromVault(romId: string): Promise<VaultRom | null> {
  if (!vaultAvailable()) return null;
  const record = await withStore<StoredRom | undefined>(
    "readonly",
    (store) => store.get(romId) as IDBRequest<StoredRom | undefined>,
  );
  if (!record) return null;
  return {
    romId,
    fileName: record.fileName,
    bytes: new Uint8Array(record.bytes),
    sizeBytes: record.sizeBytes,
    updatedAt: record.updatedAt,
  };
}

export async function deleteRomFromVault(romId: string): Promise<void> {
  if (!vaultAvailable()) return;
  await withStore("readwrite", (store) => store.delete(romId) as IDBRequest<undefined>);
}

export interface PreparedRom {
  fileName: string;
  bytes: RomBytes;
  fromZip: boolean;
}

/**
 * Read a picked ROM file (or zipped ROM archive) into raw ROM bytes ready for
 * the player and the vault.
 */
export async function prepareRomFile(file: File): Promise<PreparedRom> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    return await unwrapRomFile(file.name, bytes);
  } catch (error) {
    if (error instanceof ZipError) throw error;
    throw new ZipError(`could not read "${file.name}" — ${String(error)}`);
  }
}
