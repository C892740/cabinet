import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getPairRepo, pairView } from "@/lib/pair-repo";
import { newPairCode, PAIR_TTL_MS } from "@/lib/pairing";
import { clientIp, isSameOriginRequest, rateLimit } from "@/lib/security";

export const runtime = "nodejs";

/**
 * POST — the TV opens a pairing session: mint a fresh code, remember the
 * egress IP we see for this TV (the later "same Wi-Fi" comparison anchor).
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!rateLimit(`pair-start:${user.id}`, 10, 60_000)) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Try again soon." }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { tvName?: string } | null;
  const deviceName = (body?.tvName ?? "Living Room TV").trim().slice(0, 120);

  const repo = getPairRepo();
  const pair = await repo.createPair({
    userId: user.id,
    code: newPairCode(),
    deviceName,
    expiresAt: new Date(Date.now() + PAIR_TTL_MS),
  });
  await repo.updatePair(pair.code, {
    tvIp: clientIp(request),
    tvLastSeenAt: new Date(),
  });

  return NextResponse.json({
    ok: true,
    pair: pairView({ ...pair, tvIp: clientIp(request), tvLastSeenAt: new Date().toISOString() }),
  });
}
