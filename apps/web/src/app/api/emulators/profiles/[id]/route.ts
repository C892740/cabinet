import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/security";
import { getCloudRepo, type NewEmulatorProfile } from "@/lib/cloud-repo";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Partial<NewEmulatorProfile> | null;
  if (!body) return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
  const profile = await getCloudRepo().updateEmulatorProfile(user.id, params.id, {
    ...(typeof body.name === "string" ? { name: body.name.slice(0, 120) } : {}),
    ...(body.platformSlug !== undefined ? { platformSlug: body.platformSlug || null } : {}),
    ...(typeof body.emulatorPath === "string" ? { emulatorPath: body.emulatorPath } : {}),
    ...(typeof body.corePath === "string" ? { corePath: body.corePath } : {}),
    ...(typeof body.argsTemplate === "string" ? { argsTemplate: body.argsTemplate } : {}),
    ...(typeof body.isDefault === "boolean" ? { isDefault: body.isDefault } : {}),
  });
  if (!profile) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, profile });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const removed = await getCloudRepo().deleteEmulatorProfile(user.id, params.id);
  return removed
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
}
