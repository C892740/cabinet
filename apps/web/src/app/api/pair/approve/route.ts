import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getPairRepo, pairView } from "@/lib/pair-repo";
import { isExpired, sameNetworkVerdict } from "@/lib/pairing";
import { clientIp, isSameOriginRequest } from "@/lib/security";

export const runtime = "nodejs";

/**
 * POST — the TV confirms (or rejects) the phone that claimed its code.
 * Linking only happens here: a code alone never silently authorizes a phone.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { code?: string; approve?: boolean }
    | null;
  const code = (body?.code ?? "").replace(/[^0-9]/g, "");
  const approve = body?.approve !== false;

  const repo = getPairRepo();
  const pair = await repo.getPairByCode(code);
  if (!pair || pair.userId !== user.id) {
    return NextResponse.json({ ok: false, error: "invalid pairing code" }, { status: 404 });
  }
  if (pair.status !== "claimed" && pair.status !== "linked") {
    return NextResponse.json({ ok: false, error: "no phone is waiting on this code" }, { status: 409 });
  }

  if (!approve) {
    await repo.removePair(user.id, code);
    return NextResponse.json({ ok: true, removed: true });
  }
  if (isExpired(pair)) {
    return NextResponse.json({ ok: false, error: "this code has expired — ask the TV for a new one" }, { status: 410 });
  }

  const tvIp = clientIp(request);
  const updated = await repo.updatePair(code, {
    status: "linked",
    linkedAt: new Date(),
    tvIp,
    tvLastSeenAt: new Date(),
    sameNetwork: sameNetworkVerdict(tvIp, pair.phoneIp),
  });

  return NextResponse.json({ ok: true, pair: pairView(updated!) });
}
