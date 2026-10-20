import { NextResponse } from "next/server";
import { getRepo } from "@/lib/repo";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const rom = await getRepo().getRom(params.id);
  if (!rom) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, rom });
}
