import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/security";
import { scanFiles } from "@/lib/metadata";
import type { ScannedRomFile } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Server-side ROM scan: accept a manifest of hashed files (computed by the
 * scanner client) and return metadata matches from IGDB / ScreenScraper.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    files?: Partial<ScannedRomFile>[];
  } | null;
  const files = (body?.files ?? []).filter(
    (f): f is ScannedRomFile =>
      typeof f?.fileName === "string" &&
      f.fileName.length > 0 &&
      f.fileName.length <= 300 &&
      typeof f?.sizeBytes === "number" &&
      typeof f?.platformSlug === "string",
  );
  if (!files.length) {
    return NextResponse.json(
      { ok: false, error: "files[] with fileName, sizeBytes and platformSlug is required" },
      { status: 400 },
    );
  }

  const result = await scanFiles(files);
  return NextResponse.json({ ok: true, ...result });
}
