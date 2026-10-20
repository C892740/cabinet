/**
 * Security helpers: request-origin checks and a tiny in-memory rate limiter.
 *
 * These are defence-in-depth alongside SameSite=Lax cookies. A production
 * deployment should additionally sit behind a real edge rate limiter.
 */

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

/** Reject cross-origin mutations (CSRF defence). */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    // Non-browser clients (desktop app) send no Origin header; they carry the
    // session cookie with SameSite=Lax, which browsers will not attach to
    // cross-site POSTs.
    return true;
  }
  const host = request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}
