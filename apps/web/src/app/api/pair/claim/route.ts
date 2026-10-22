import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getPairRepo, pairView } from "@/lib/pair-repo";
import { isExpired, sameNetworkVerdict } from "@/lib/pairing";
import { clientIp, isSameOriginRequest, rateLimit } from "@/lib/security";

export const runtime = "nodejs";

/**
 * POST — the phone claims the code shown on the TV. Requires the same
 * Cabinet account (the link is between two devices of one library), and
 * records the phone's egress IP so the server can compare it with the TV's:
 * equal IPs ⇒ same Wi-Fi.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!rateLimit(`pair-claim:${user.id}`, 15, 60_000)) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Try again soon." }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as
    | { code?: string; phoneName?: string; phoneModel?: string }
    | null;
  const code = (body?.code ?? "").replace(/[^0-9]/g, "");
  if (code.length !== 6) {
    return NextResponse.json({ ok: false, error: "a 6-digit pairing code is required" }, { status: 400 });
  }

  const repo = getPairRepo();
  const pair = await repo.getPairByCode(code);
  if (!pair || pair.userId !== user.id) {
    return NextResponse.json({ ok: false, error: "invalid pairing code" }, { status: 404 });
  }
  if (isExpired(pair) && pair.status !== "linked") {
    return NextResponse.json({ ok: false, error: "this code has expired — ask the TV for a new one" }, { status: 410 });
  }
  if (pair.status !== "waiting" && pair.status !== "claimed") {
    return NextResponse.json({ ok: false, error: "this code is no longer accepting phones" }, { status: 409 });
  }

  const phoneIp = clientIp(request);
  const updated = await repo.updatePair(code, {
    phoneName: (body?.phoneName ?? "").trim().slice(0, 120),
    phoneModel: (body?.phoneModel ?? "").trim().slice(0, 120),
    phoneIp,
    phoneLastSeenAt: new Date(),
    status: "claimed",
    sameNetwork: sameNetworkVerdict(pair.tvIp, phoneIp),
  });

  return NextResponse.json({ ok: true, pair: pairView(updated!) });
}
