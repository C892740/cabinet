import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getRomBlobRepo, type NewRomBlob } from "@/lib/rom-blob-repo";
import { base64ToBytes, MAX_ROM_BYTES, ROM_CHUNK_BYTES, type RomBlobMeta } from "@/lib/rom-sync";
import { isSameOriginRequest } from "@/lib/security";

export const runtime = "nodejs";

/**
 * The uploaded ROM file for one library entry (mine only).
 *
 * POST — one base64 chunk of a chunked upload.
 * GET  — the whole ROM as one binary stream (EmulatorJS fetches this URL);
 *        `?meta=1` returns just the metadata for the "is it attached?" check.
 * HEAD — same headers, no body.
 * DELETE — detach the file from the account.
 */

const MAX_CHUNKS = Math.ceil(MAX_ROM_BYTES / ROM_CHUNK_BYTES) + 1;

function romHeaders(meta: RomBlobMeta): HeadersInit {
  return {
    "Content-Type": "application/octet-stream",
    "Content-Length": String(meta.sizeBytes),
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(meta.fileName)}`,
    "X-Cabinet-Rom-Name": encodeURIComponent(meta.fileName),
    "Cache-Control": "private, no-store",
  };
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const repo = getRomBlobRepo();
  const meta = await repo.getMeta(user.id, params.id);

  const url = new URL(request.url);
  if (url.searchParams.has("meta")) {
    return NextResponse.json({ ok: true, meta });
  }
  if (!meta) {
    return NextResponse.json({ ok: false, error: "no ROM attached to this game" }, { status: 404 });
  }
  if (request.method === "HEAD") {
    return new Response(null, { headers: romHeaders(meta) });
  }

  // Reassemble lazily: one chunk in memory at a time, whatever the ROM size.
  let index = 0;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (index >= meta.totalChunks) {
        controller.close();
        return;
      }
      try {
        const chunk = await repo.getChunk(user.id, params.id, index);
        index += 1;
        if (chunk == null) throw new Error("ROM upload is incomplete — attach the file again");
        controller.enqueue(base64ToBytes(chunk));
      } catch (error) {
        controller.error(error);
      }
    },
  });
  return new Response(stream, { headers: romHeaders(meta) });
}

export async function HEAD(request: Request, context: { params: { id: string } }) {
  return GET(request, context);
}

/** Upload one chunk of the ROM file. Idempotent per (rom, index). */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | {
        index?: number;
        total?: number;
        fileName?: string;
        sizeBytes?: number;
        chunkSize?: number;
        data?: string;
      }
    | null;

  const index = body?.index;
  const total = body?.total;
  const data = body?.data;
  if (
    typeof index !== "number" ||
    typeof total !== "number" ||
    typeof data !== "string" ||
    !Number.isInteger(index) ||
    !Number.isInteger(total) ||
    index < 0 ||
    total < 1 ||
    index >= total ||
    total > MAX_CHUNKS
  ) {
    return NextResponse.json(
      { ok: false, error: "index, total and data (base64) are required" },
      { status: 400 },
    );
  }

  const sizeBytes = typeof body?.sizeBytes === "number" ? body.sizeBytes : 0;
  if (sizeBytes > MAX_ROM_BYTES) {
    return NextResponse.json(
      { ok: false, error: `ROM exceeds ${MAX_ROM_BYTES} bytes` },
      { status: 413 },
    );
  }

  const blob: NewRomBlob = {
    romId: params.id,
    fileName: (body?.fileName ?? "game.rom").slice(0, 255),
    sizeBytes,
    chunkSize: body?.chunkSize ?? ROM_CHUNK_BYTES,
    totalChunks: total,
  };
  await getRomBlobRepo().putChunk(user.id, blob, index, data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const removed = await getRomBlobRepo().deleteBlob(user.id, params.id);
  return NextResponse.json({ ok: true, removed });
}
