import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/security";
import { getCloudRepo, type NewEmulatorProfile } from "@/lib/cloud-repo";

export const runtime = "nodejs";

/** Desktop emulator launch profiles for the signed-in user. */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const profiles = await getCloudRepo().listEmulatorProfiles(user.id);
  return NextResponse.json({ ok: true, profiles });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Partial<NewEmulatorProfile> | null;
  if (!body?.name?.trim() || !body.emulatorPath?.trim()) {
    return NextResponse.json(
      { ok: false, error: "name and emulatorPath are required" },
      { status: 400 },
    );
  }
  const profile = await getCloudRepo().createEmulatorProfile(user.id, {
    name: body.name.trim().slice(0, 120),
    platformSlug: body.platformSlug || null,
    emulatorPath: body.emulatorPath.trim(),
    corePath: typeof body.corePath === "string" ? body.corePath.trim() : "",
    argsTemplate: typeof body.argsTemplate === "string" ? body.argsTemplate : "{rom}",
    isDefault: Boolean(body.isDefault),
  });
  return NextResponse.json({ ok: true, profile }, { status: 201 });
}
