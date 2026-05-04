import { NextResponse } from "next/server";
import { withAdmin } from "@/server/auth/admin-route";
import { prisma } from "@/server/db/client";
import { applyManualShipmentStatus } from "@/server/fulfilment/shipment-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const ALLOWED = ["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "EXCEPTION"] as const;
type AllowedStatus = (typeof ALLOWED)[number];

/**
 * Manual tracking-status push. Used by the print-and-despatch flow (status
 * = IN_TRANSIT) and by ops who need to fix up state when the carrier feed
 * has lagged.
 */
export const POST = withAdmin<Ctx>(async (req, { params }, user) => {
  const { id: orderId } = await params;
  const body = (await req.json().catch(() => null)) as
    | { shipmentId?: string; status?: string }
    | null;
  if (!body?.shipmentId || !body.status) {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "shipmentId + status required" },
      { status: 400 },
    );
  }
  if (!(ALLOWED as readonly string[]).includes(body.status)) {
    return NextResponse.json(
      { error: "INVALID_STATUS", message: `status must be one of ${ALLOWED.join(", ")}` },
      { status: 400 },
    );
  }

  const shipment = await prisma.shipment.findUnique({
    where: { id: body.shipmentId },
  });
  if (!shipment || shipment.orderId !== orderId) {
    return NextResponse.json(
      { error: "SHIPMENT_NOT_FOUND" },
      { status: 404 },
    );
  }

  await applyManualShipmentStatus(
    body.shipmentId,
    body.status as AllowedStatus,
    user.id,
  );
  return NextResponse.json({ ok: true });
});
