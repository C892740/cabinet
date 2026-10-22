import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getPairRepo, pairView } from "@/lib/pair-repo";
import { canAutoImport, sameNetworkVerdict, TV_FRESH_MS } from "@/lib/pairing";
import { clientIp, isSameOriginRequest } from "@/lib/security";

export const runtime = "nodejs";

/**
 * POST — heartbeat + re-verification from either side ({ code, side }).
 *
 * Each call refreshes that side's observed egress IP, so the same-network
 * verdict stays honest: a phone that leaves the Wi-Fi loses it, and the TV's
 * "present" flag tracks its last poll. The phone gates ROM auto-import on
 * `canAutoImport` from this response.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { code?: string; side?: "tv" | "phone" }
    | null;
  const code = (body?.code ?? "").replace(/[^0-9]/g, "");
  const side = body?.side === "phone" ? "phone" : "tv";

  const repo = getPairRepo();
  const pair = await repo.getPairByCode(code);
  if (!pair || pair.userId !== user.id) {
    return NextResponse.json({ ok: false, error: "invalid pairing code" }, { status: 404 });
  }

  const ip = clientIp(request);
  const patch =
    side === "tv"
      ? { tvIp: ip, tvLastSeenAt: new Date() }
      : { phoneIp: ip, phoneLastSeenAt: new Date() };
  const next = await repo.updatePair(code, patch);
  const merged = { ...pair, ...patch, ...next! };
  const sameNetwork = sameNetworkVerdict(merged.tvIp, merged.phoneIp);
  const updated = await repo.updatePair(code, { sameNetwork });
  const record = { ...merged, ...updated! };

  return NextResponse.json({
    ok: true,
    pair: pairView(record),
    sameNetwork,
    canAutoImport: canAutoImport(record).ok,
    tvFreshWindowMs: TV_FRESH_MS,
  });
}
