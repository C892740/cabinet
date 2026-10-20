/**
 * Opaque session tokens.
 *
 * The token itself is 32 bytes of randomness given to the client as an
 * HttpOnly cookie. Only its SHA-256 hash is stored server-side, so a database
 * leak can never be replayed as a login. Sessions are revocable per-row.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "cabinet_session";
export const ADMIN_COOKIE = "cabinet_admin";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const ADMIN_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

export function newSessionToken(): { token: string; tokenHash: string; expiresAt: Date } {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function secret(): string {
  return process.env.SESSION_SECRET ?? "cabinet-dev-secret-change-me";
}

function sign(value: string): string {
  return createHash("sha256").update(`${value}.${secret()}`).digest("base64url");
}

/**
 * Admin sessions are stateless signed tokens (short TTL) so the admin
 * dashboard works with or without a database configured.
 */
export function issueAdminToken(): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + ADMIN_TTL_MS;
  const payload = `admin.${expiresAt}`;
  return { token: `${payload}.${sign(payload)}`, expiresAt };
}

export function verifyAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [scope, expiresAtStr, signature] = parts as [string, string, string];
  if (scope !== "admin") return false;
  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;
  const expected = Buffer.from(sign(`${scope}.${expiresAtStr}`), "utf8");
  const actual = Buffer.from(signature, "utf8");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function setCookie(
  name: string,
  value: string,
  maxAgeSeconds: number,
  httpOnly = true,
): void {
  cookies().set(name, value, {
    httpOnly,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export function clearCookie(name: string): void {
  cookies().set(name, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export const sessionMaxAgeSeconds = () => SESSION_TTL_MS / 1000;
export const adminMaxAgeSeconds = () => ADMIN_TTL_MS / 1000;
