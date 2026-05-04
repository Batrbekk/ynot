import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/admin";
import { prisma } from "@/server/db/client";
import { getLabelStorage } from "@/server/fulfilment/storage-factory";
import { env } from "@/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Auth-gated PDF stream. The print-and-despatch page embeds this in an
 * iframe — every byte still goes through the role check (defence-in-depth on
 * top of the middleware cookie gate).
 *
 * 404 when the shipment is missing or has no stored label key, 500 when the
 * storage backend can't deliver bytes (e.g. stale local-fs file).
 */
export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  try {
    await requireAdmin();
  } catch (e) {
    const err = e as Error & { status?: number };
    return NextResponse.json(
      { error: err.message ?? "ERROR" },
      { status: err.status ?? 500 },
    );
  }
  const { id } = await params;
  const shipment = await prisma.shipment.findUnique({ where: { id } });
  if (!shipment || !shipment.labelStorageKey) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const storage = getLabelStorage(env);
  let pdf: Buffer;
  try {
    pdf = await storage.get(shipment.labelStorageKey);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "STORAGE", message },
      { status: 500 },
    );
  }
  // Convert Buffer to ArrayBuffer — Web `Response` accepts ArrayBuffer/
  // ArrayBufferView. Slice ensures we copy out exactly the underlying bytes
  // (Node Buffers can be views over a larger pool).
  const ab = pdf.buffer.slice(
    pdf.byteOffset,
    pdf.byteOffset + pdf.byteLength,
  ) as ArrayBuffer;
  return new Response(ab, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.byteLength),
      "Content-Disposition": `inline; filename="label-${id}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
