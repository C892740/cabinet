/**
 * Pairing helpers shared by the /api/pair routes: code format, expiry rules
 * and the "same Wi-Fi" verdict.
 *
 * How the Smart View-style link is verified: the server compares the egress
 * IPs it observes for the TV and the phone. Equal IPs ⇒ both sit behind the
 * same NAT — i.e. the same Wi-Fi — which is exactly the condition the mobile
 * apps require before auto-importing ROMs. Heartbeats keep both observations
 * fresh, so a phone that roams to cellular loses the verdict until it returns.
 */

import type { PairRecord, PairView } from "./pair-repo";

/** Pairing codes live 10 minutes — long enough for a TV screen, short enough to expire. */
export const PAIR_TTL_MS = 10 * 60 * 1000;

/** A TV counts as "present" while it heartbeats at least this often. */
export const TV_FRESH_MS = 2 * 60 * 1000;

/** Digits in a pairing code (Netflix/Chromecast style: easy to type on a phone). */
const CODE_DIGITS = 6;

export function newPairCode(): string {
  let code = "";
  for (let i = 0; i < CODE_DIGITS; i += 1) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

/** "483291" is shown and accepted as "483-291" for readability. */
export function normalizePairCode(input: string): string {
  return input.replace(/[^0-9]/g, "").slice(0, CODE_DIGITS);
}

export function formatPairCode(code: string): string {
  return code.length > 3 ? `${code.slice(0, 3)}-${code.slice(3)}` : code;
}

export function isExpired(pair: PairRecord | PairView): boolean {
  return Date.parse(pair.expiresAt) < Date.now();
}

/**
 * The same-network verdict for a claimed/linked pair: both sides must present
 * the *same* server-observed egress address. Behind NAT (the normal home
 * case) equal egress IPs mean the phone and TV sit behind the same router —
 * the "same Wi-Fi" check.
 *
 * A deployment that exposes no client-IP metadata (e.g. self-hosted on a LAN
 * without a proxy) reports "unknown" for every client; equal values still
 * count as same-network there, because reaching such a server already
 * requires being on its LAN. Proxied deployments (Vercel, nginx, …) always
 * carry x-forwarded-for and get the real comparison.
 */
export function sameNetworkVerdict(tvIp: string, phoneIp: string): boolean {
  if (!tvIp || !phoneIp) return false;
  return tvIp === phoneIp;
}

/** Can this phone auto-import ROMs right now? (linked + same Wi-Fi + TV present) */
export function canAutoImport(pair: PairRecord | PairView): {
  ok: boolean;
  reason: "not-linked" | "different-network" | "tv-offline" | "ready";
} {
  if (pair.status !== "linked") return { ok: false, reason: "not-linked" };
  if (!pair.sameNetwork) return { ok: false, reason: "different-network" };
  const seen = pair.tvLastSeenAt ? Date.parse(pair.tvLastSeenAt) : 0;
  if (!seen || Date.now() - seen > TV_FRESH_MS) return { ok: false, reason: "tv-offline" };
  return { ok: true, reason: "ready" };
}
