/**
 * Cabinet Key Vault
 * -----------------
 * Encrypts a secret (the admin dashboard key-password) into a portable
 * `.cabinet` file that only the holder of the master passphrase can open.
 *
 * Construction (v1):
 *   master passphrase --(scrypt, N=2^15, r=8, p=1)--> 32-byte key
 *   key --(AES-256-GCM)--> ciphertext + 16-byte auth tag
 *
 * Properties:
 *   • Confidentiality + integrity: GCM authenticates the ciphertext *and* the
 *     encoded header, so a tampered vault fails to open instead of producing
 *     garbage plaintext.
 *   • Passphrase hardening: scrypt (memory-hard) with a random 16-byte salt.
 *   • Portable: the whole vault is a small JSON file — it can live on a USB
 *     stick, in a password manager, or in the desktop app's data folder.
 *
 * Why not store the admin key in plain config? The vault lets an operator carry
 * the admin key encrypted at rest and "convert it to a normal readable
 * password" only at the moment it is needed, in memory, for a short window.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scrypt as scryptCb,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

export const KEYVAULT_FORMAT = "cabinet-keyvault" as const;

export interface KeyVaultKdf {
  name: "scrypt";
  N: number;
  r: number;
  p: number;
  /** base64 */
  salt: string;
  keyLength: number;
}

export interface KeyVaultCipher {
  name: "aes-256-gcm";
  /** base64 */
  iv: string;
  /** base64 */
  tag: string;
}

export interface KeyVaultFile {
  format: typeof KEYVAULT_FORMAT;
  version: 1;
  label: string;
  kdf: KeyVaultKdf;
  cipher: KeyVaultCipher;
  /** base64 ciphertext */
  ciphertext: string;
  createdAt: string;
}

export interface KeyVaultHeader {
  format: typeof KEYVAULT_FORMAT;
  version: 1;
  label: string;
  createdAt: string;
  kdf: Pick<KeyVaultKdf, "name" | "N" | "r" | "p">;
  cipher: Pick<KeyVaultCipher, "name">;
}

const KDF: Omit<KeyVaultKdf, "salt"> = {
  name: "scrypt",
  N: 32768, // 2^15 — ~32 MB of memory per derivation
  r: 8,
  p: 1,
  keyLength: 32,
};

const MAXMEM = 128 * 1024 * 1024;

export class KeyVaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KeyVaultError";
  }
}

/** Generate a strong, URL-safe admin key-password. */
export function generateAdminKey(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

function deriveKey(passphrase: string, kdf: KeyVaultKdf): Promise<Buffer> {
  if (typeof passphrase !== "string" || passphrase.length < 8) {
    throw new KeyVaultError(
      "Master passphrase must be at least 8 characters long.",
    );
  }
  return scrypt(passphrase, Buffer.from(kdf.salt, "base64"), kdf.keyLength, {
    N: kdf.N,
    r: kdf.r,
    p: kdf.p,
    maxmem: MAXMEM,
  });
}

function encodeHeader(file: KeyVaultFile): Buffer {
  const header: KeyVaultHeader = {
    format: file.format,
    version: file.version,
    label: file.label,
    createdAt: file.createdAt,
    kdf: { name: file.kdf.name, N: file.kdf.N, r: file.kdf.r, p: file.kdf.p },
    cipher: { name: file.cipher.name },
  };
  return Buffer.from(JSON.stringify(header), "utf8");
}

/** Seal a secret into an encrypted vault file. */
export async function sealSecret(
  plaintext: string,
  passphrase: string,
  label = "admin-dashboard-key",
): Promise<KeyVaultFile> {
  const salt = randomBytes(16);
  const kdf: KeyVaultKdf = { ...KDF, salt: salt.toString("base64") };
  const key = await deriveKey(passphrase, kdf);

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const file: KeyVaultFile = {
    format: KEYVAULT_FORMAT,
    version: 1,
    label,
    kdf,
    cipher: { name: "aes-256-gcm", iv: iv.toString("base64"), tag: "" },
    ciphertext: "",
    createdAt: new Date().toISOString(),
  };

  // Authenticate the header alongside the ciphertext so both are tamper-proof.
  cipher.setAAD(encodeHeader(file));
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  file.cipher.tag = cipher.getAuthTag().toString("base64");
  file.ciphertext = ciphertext.toString("base64");
  return file;
}

/** Open a vault file and return the secret as readable text. */
export async function revealSecret(
  file: KeyVaultFile,
  passphrase: string,
): Promise<string> {
  if (!isKeyVaultFile(file)) {
    throw new KeyVaultError("Not a Cabinet key vault file.");
  }
  const key = await deriveKey(passphrase, file.kdf);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(file.cipher.iv, "base64"),
  );
  decipher.setAAD(encodeHeader(file));
  decipher.setAuthTag(Buffer.from(file.cipher.tag, "base64"));
  try {
    return Buffer.concat([
      decipher.update(Buffer.from(file.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // GCM rejects both a wrong passphrase and tampered data.
    throw new KeyVaultError(
      "Could not open the vault — wrong master passphrase or damaged file.",
    );
  }
}

export function isKeyVaultFile(value: unknown): value is KeyVaultFile {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<KeyVaultFile>;
  return (
    v.format === KEYVAULT_FORMAT &&
    v.version === 1 &&
    typeof v.label === "string" &&
    typeof v.ciphertext === "string" &&
    typeof v.kdf?.salt === "string" &&
    typeof v.cipher?.iv === "string" &&
    typeof v.cipher?.tag === "string"
  );
}

/** Public metadata safe to display without the passphrase. */
export function inspectVault(file: KeyVaultFile): KeyVaultHeader {
  if (!isKeyVaultFile(file)) throw new KeyVaultError("Not a Cabinet key vault file.");
  return {
    format: file.format,
    version: file.version,
    label: file.label,
    createdAt: file.createdAt,
    kdf: { name: file.kdf.name, N: file.kdf.N, r: file.kdf.r, p: file.kdf.p },
    cipher: { name: file.cipher.name },
  };
}

export function serializeVault(file: KeyVaultFile): string {
  return JSON.stringify(file, null, 2) + "\n";
}

export function parseVault(raw: string): KeyVaultFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new KeyVaultError("Vault file is not valid JSON.");
  }
  if (!isKeyVaultFile(parsed)) {
    throw new KeyVaultError("Vault file is missing required fields.");
  }
  return parsed;
}
