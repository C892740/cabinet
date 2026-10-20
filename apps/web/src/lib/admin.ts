/**
 * Admin key-password verification.
 *
 * Two supported configurations (see .env.example):
 *   ADMIN_KEY       — the key itself (simple, dev-friendly)
 *   ADMIN_KEY_HASH  — scrypt digest produced by `cabinet-keyvault hash`
 *                     (recommended: the server never stores the key)
 */

import { verifyPassword, safeEqual } from "./password";

export interface AdminKeyCheck {
  ok: boolean;
  reason?: "missing-config" | "bad-key";
}

export async function verifyAdminKey(key: string): Promise<AdminKeyCheck> {
  const hash = process.env.ADMIN_KEY_HASH?.trim();
  const plain = process.env.ADMIN_KEY?.trim();

  if (hash) {
    const ok = await verifyPassword(key, hash);
    return ok ? { ok: true } : { ok: false, reason: "bad-key" };
  }
  if (plain) {
    return safeEqual(key, plain)
      ? { ok: true }
      : { ok: false, reason: "bad-key" };
  }
  return { ok: false, reason: "missing-config" };
}

export function adminKeyConfigured(): boolean {
  return Boolean(process.env.ADMIN_KEY_HASH?.trim() || process.env.ADMIN_KEY?.trim());
}
