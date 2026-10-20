#!/usr/bin/env node
/**
 * cabinet-keyvault
 * ----------------
 * The operator's key holder. It keeps the admin dashboard key-password
 * encrypted at rest and converts it back to readable text only on demand.
 *
 *   cabinet-keyvault generate [--out admin.key.txt] [--seal admin.cabinet]
 *   cabinet-keyvault seal     --in admin.key.txt --out admin.cabinet [--label NAME]
 *   cabinet-keyvault reveal   --in admin.cabinet [--out admin.key.txt]
 *   cabinet-keyvault inspect  --in admin.cabinet
 *   cabinet-keyvault hash     [--in admin.key.txt]      -> scrypt hash for ADMIN_KEY_HASH
 *   cabinet-keyvault selftest                            -> round-trip verification
 *
 * The master passphrase is taken from (in order):
 *   1. --pass <passphrase>          (avoid; visible in shell history)
 *   2. CABINET_KEYVAULT_PASSPHRASE  (env — good for CI/testing)
 *   3. an interactive hidden prompt (the normal path)
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { createInterface } from "node:readline";
import {
  generateAdminKey,
  sealSecret,
  revealSecret,
  inspectVault,
  parseVault,
  serializeVault,
  KeyVaultError,
} from "@cabinet/core";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

interface Args {
  command: string;
  flags: Map<string, string | boolean>;
}

function parseArgs(argv: string[]): Args {
  const [command = "help", ...rest] = argv;
  const flags = new Map<string, string | boolean>();
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i]!;
    if (!token.startsWith("--")) continue;
    const name = token.slice(2);
    const next = rest[i + 1];
    if (next && !next.startsWith("--")) {
      flags.set(name, next);
      i++;
    } else {
      flags.set(name, true);
    }
  }
  return { command, flags };
}

function flagStr(args: Args, name: string): string | undefined {
  const v = args.flags.get(name);
  return typeof v === "string" ? v : undefined;
}

function requireFile(args: Args, name: string): string {
  const v = flagStr(args, name);
  if (!v) fail(`Missing required flag --${name}`);
  return v;
}

function fail(message: string): never {
  console.error(`\n  ✖ ${message}\n`);
  process.exit(1);
}

function readSecretFile(path: string): string {
  if (!existsSync(path)) fail(`File not found: ${path}`);
  return readFileSync(path, "utf8").trim();
}

/** Hidden passphrase prompt (no echo). */
async function promptHidden(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const write = (text: string) => process.stdout.write(text);

    write(question);
    let value = "";
    const onData = (chunk: Buffer) => {
      const char = chunk.toString("utf8");
      for (const c of char) {
        if (c === "\n" || c === "\r" || c === "\u0004") {
          stdin.removeListener("data", onData);
          stdin.setRawMode?.(false);
          stdin.pause();
          write("\n");
          rl.close();
          resolve(value);
          return;
        }
        if (c === "\u0003") process.exit(130);
        if (c === "\u007f" || c === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        value += c;
      }
    };
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

async function getPassphrase(args: Args, confirm = false): Promise<string> {
  const direct = flagStr(args, "pass");
  if (direct) return direct;
  const fromEnv = process.env.CABINET_KEYVAULT_PASSPHRASE;
  if (fromEnv) return fromEnv;
  if (!process.stdin.isTTY) {
    fail(
      "No passphrase source. Use --pass, CABINET_KEYVAULT_PASSPHRASE, or run in an interactive terminal.",
    );
  }
  const pass = await promptHidden("  Master passphrase: ");
  if (pass.length < 8) fail("Master passphrase must be at least 8 characters.");
  if (confirm) {
    const again = await promptHidden("  Confirm passphrase: ");
    if (again !== pass) fail("Passphrases do not match.");
  }
  return pass;
}

/** One-way scrypt digest, for ADMIN_KEY_HASH in server config. */
export async function hashSecret(
  secret: string,
  salt = randomBytes(16),
): Promise<string> {
  const N = 32768;
  const digest = await scrypt(secret, salt, 32, { N, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
  return `scrypt$${N}$8$1$${salt.toString("base64")}$${digest.toString("base64")}`;
}

export async function verifySecretHash(
  secret: string,
  encoded: string,
): Promise<boolean> {
  const parts = encoded.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4]!, "base64");
  const expected = Buffer.from(parts[5]!, "base64");
  const actual = await scrypt(secret, salt, expected.length, {
    N,
    r,
    p,
    maxmem: 128 * 1024 * 1024,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  switch (args.command) {
    case "generate": {
      const key = generateAdminKey();
      const out = flagStr(args, "out");
      if (out) {
        writeFileSync(out, key + "\n", { mode: 0o600 });
        console.log(`\n  ✔ Admin key generated → ${out}`);
      } else {
        console.log(`\n  Admin key:\n\n    ${key}\n`);
      }
      const sealTo = flagStr(args, "seal");
      if (sealTo) {
        const passphrase = await getPassphrase(args, true);
        const vault = await sealSecret(key, passphrase, flagStr(args, "label") ?? "admin-dashboard-key");
        writeFileSync(sealTo, serializeVault(vault), { mode: 0o600 });
        console.log(`  ✔ Sealed into vault → ${sealTo}`);
        if (!out) console.log(`  ℹ Store only the vault; the printed key stays in memory.`);
      }
      console.log("");
      break;
    }

    case "seal": {
      const inPath = requireFile(args, "in");
      const outPath = requireFile(args, "out");
      const secret = readSecretFile(inPath);
      const passphrase = await getPassphrase(args, true);
      const vault = await sealSecret(secret, passphrase, flagStr(args, "label") ?? "admin-dashboard-key");
      writeFileSync(outPath, serializeVault(vault), { mode: 0o600 });
      console.log(`\n  ✔ Sealed ${inPath} → ${outPath} (${vault.kdf.name}, ${vault.cipher.name})\n`);
      break;
    }

    case "reveal": {
      const inPath = requireFile(args, "in");
      const vault = parseVault(readFileSync(inPath, "utf8"));
      const passphrase = await getPassphrase(args);
      const secret = await revealSecret(vault, passphrase);
      const outPath = flagStr(args, "out");
      if (outPath) {
        writeFileSync(outPath, secret + "\n", { mode: 0o600 });
        console.log(`\n  ✔ Vault opened → readable key written to ${outPath}\n`);
      } else {
        console.log(`\n  ${secret}\n`);
      }
      break;
    }

    case "inspect": {
      const inPath = requireFile(args, "in");
      const vault = parseVault(readFileSync(inPath, "utf8"));
      const header = inspectVault(vault);
      console.log(`\n  Vault label   : ${header.label}`);
      console.log(`  Created at    : ${header.createdAt}`);
      console.log(`  Cipher        : ${header.cipher.name}`);
      console.log(
        `  KDF           : ${header.kdf.name} (N=${header.kdf.N}, r=${header.kdf.r}, p=${header.kdf.p})`,
      );
      console.log(`  Ciphertext    : ${vault.ciphertext.length} base64 chars\n`);
      break;
    }

    case "hash": {
      const inPath = flagStr(args, "in");
      const secret = inPath
        ? readSecretFile(inPath)
        : (await getPassphrase(args)).trim();
      const encoded = await hashSecret(secret);
      console.log(`\n  Set this as ADMIN_KEY_HASH:\n\n    ${encoded}\n`);
      break;
    }

    case "selftest": {
      const secret = generateAdminKey();
      const passphrase = "correct-horse-battery-staple";
      const vault = await sealSecret(secret, passphrase);
      const opened = await revealSecret(vault, passphrase);
      if (opened !== secret) fail("Round-trip mismatch: revealed secret differs from the original.");
      let wrongPassRejected = false;
      try {
        await revealSecret(vault, "not-the-right-passphrase");
      } catch (err) {
        wrongPassRejected = err instanceof KeyVaultError;
      }
      if (!wrongPassRejected) fail("A wrong passphrase was not rejected.");
      const hash = await hashSecret(secret);
      if (!(await verifySecretHash(secret, hash))) fail("Hash verification failed.");
      if (await verifySecretHash("other-secret", hash)) fail("Hash verification accepted a wrong secret.");
      console.log("\n  ✔ keyvault selftest passed");
      console.log("    • generate → seal → reveal round-trip: OK");
      console.log("    • wrong master passphrase rejected: OK");
      console.log("    • scrypt ADMIN_KEY_HASH verify/reject: OK\n");
      break;
    }

    default:
      console.log(`
  cabinet-keyvault — encrypted admin-key holder for Cabinet

  Usage:
    cabinet-keyvault generate [--out FILE] [--seal FILE] [--label NAME]
    cabinet-keyvault seal     --in FILE --out FILE [--label NAME]
    cabinet-keyvault reveal   --in FILE [--out FILE]
    cabinet-keyvault inspect  --in FILE
    cabinet-keyvault hash     [--in FILE]
    cabinet-keyvault selftest
`);
  }
}

main().catch((err: unknown) => {
  if (err instanceof KeyVaultError) fail(err.message);
  fail(err instanceof Error ? err.message : String(err));
});
