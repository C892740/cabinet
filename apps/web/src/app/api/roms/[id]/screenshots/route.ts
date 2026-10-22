import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/security";
import {
  base64Bytes,
  getCloudRepo,
  MAX_SCREENSHOT_BYTES,
  type NewScreenshot,
} from "@/lib/cloud-repo";

export const runtime = "nodejs";

/** Screenshots captured in the player for one rom (mine only). */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const shots = await getCloudRepo().listScreenshots(user.id, params.id);
  return NextResponse.json({ ok: true, screenshots: shots });
}

/** Upload a base64 PNG screenshot to the account. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Partial<NewScreenshot> | null;
  if (!body?.imageData || typeof body.imageData !== "string") {
    return NextResponse.json({ ok: false, error: "imageData (base64) is required" }, { status: 400 });
  }
  if (base64Bytes(body.imageData) > MAX_SCREENSHOT_BYTES) {
    return NextResponse.json(
      { ok: false, error: `image exceeds ${MAX_SCREENSHOT_BYTES} bytes` },
      { status: 413 },
    );
  }

  const screenshot = await getCloudRepo().createScreenshot(user.id, {
    romId: params.id,
    imageData: body.imageData,
    caption: typeof body.caption === "string" ? body.caption.slice(0, 200) : "",
  });
  return NextResponse.json({ ok: true, screenshot }, { status: 201 });
}
