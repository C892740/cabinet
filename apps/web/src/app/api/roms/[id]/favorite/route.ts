import { NextResponse } from "next/server";
import { getRepo } from "@/lib/repo";
import { isSameOriginRequest } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const rom = await getRepo().toggleFavorite(params.id);
  if (!rom) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, rom });
}
