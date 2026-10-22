import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getPairRepo, pairView } from "@/lib/pair-repo";
import { isExpired } from "@/lib/pairing";

export const runtime = "nodejs";

/**
 * GET ?code=483291 — live pairing state. Polled by the TV (waiting for a
 * phone) and by the phone (waiting for the TV's approval).
 */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const code = new URL(request.url).searchParams.get("code") ?? "";
  const repo = getPairRepo();
  const pair = await repo.getPairByCode(code);
  if (!pair || pair.userId !== user.id) {
    return NextResponse.json({ ok: false, error: "no such pairing code" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    pair: pairView(pair),
    expired: isExpired(pair) && pair.status !== "linked",
  });
}
