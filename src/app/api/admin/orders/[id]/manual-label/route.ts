import { NextResponse } from "next/server";
import { withAdmin } from "@/server/auth/admin-route";
import { prisma } from "@/server/db/client";
import { getLabelStorage } from "@/server/fulfilment/storage-factory";
import { env } from "@/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Operator-supplied label override. Used when a carrier's API has refused
 * label generation past the retry budget and the team has manually obtained
 * one (e.g. from the carrier's web portal).
 *
 * Body is multipart/form-data with three parts: `shipmentId`, `trackingNumber`,
 * `labelPdf` (the PDF file). On success the Shipment row gets the tracking
 * number, the storage key, and `labelGeneratedAt = now`, and `attemptCount`
 * is reset to 0 so any future automated cron pass doesn't second-guess us.
 */
export const POST = withAdmin<Ctx>(async (req, { params }) => {
  const { id: orderId } = await params;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const shipmentId = form.get("shipmentId");
  const trackingNumber = form.get("trackingNumber");
  const labelPdf = form.get("labelPdf");
  if (
    typeof shipmentId !== "string" ||
    typeof trackingNumber !== "string" ||
    !(labelPdf instanceof Blob)
  ) {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "shipmentId, trackingNumber, labelPdf required" },
      { status: 400 },
    );
  }

  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment || shipment.orderId !== orderId) {
    return NextResponse.json(
      { error: "SHIPMENT_NOT_FOUND" },
      { status: 404 },
    );
  }

  const buffer = Buffer.from(await labelPdf.arrayBuffer());
  if (buffer.length === 0) {
    return NextResponse.json({ error: "EMPTY_PDF" }, { status: 400 });
  }
  const storage = getLabelStorage(env);
  const key = await storage.put(`manual-${shipmentId}`, buffer);

  await prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      trackingNumber,
      labelStorageKey: key,
      labelGeneratedAt: new Date(),
      attemptCount: 0,
      lastAttemptError: null,
    },
  });

  return NextResponse.json({ ok: true, key });
});
