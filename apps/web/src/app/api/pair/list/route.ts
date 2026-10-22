import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getPairRepo, pairView } from "@/lib/pair-repo";

export const runtime = "nodejs";

/** GET — every linked phone ↔ TV pair of this account (TV panel + phone app). */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const pairs = await getPairRepo().listPairs(user.id, true);
  return NextResponse.json({ ok: true, pairs: pairs.map(pairView) });
}
