import { NextResponse } from "next/server";
import { withAdmin } from "@/server/auth/admin-route";
import { prisma } from "@/server/db/client";
import { enqueueOrderShippedEmail } from "@/server/fulfilment/shipment-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Re-enqueues the OrderShipped email for the latest despatched shipment on
 * this order. Idempotent within reason — `force: true` skips the dedup
 * gate, so an operator pushing this twice within seconds will queue two
 * jobs (intentional: they wanted to resend).
 *
 * 404 if no despatched shipment with a tracking number exists. The UI's
 * "Resend tracking email" button is disabled in that case but defense-in-
 * depth here guards against a stale render.
 */
export const POST = withAdmin<Ctx>(async (_req, { params }) => {
  const { id: orderId } = await params;
  const shipment = await prisma.shipment.findFirst({
    where: {
      orderId,
      shippedAt: { not: null },
      trackingNumber: { not: null },
      cancelledAt: null,
    },
    orderBy: { shippedAt: "desc" },
  });
  if (!shipment) {
    return NextResponse.json(
      { error: "NO_DESPATCHED_SHIPMENT", message: "no despatched shipment to resend tracking for" },
      { status: 404 },
    );
  }
  await enqueueOrderShippedEmail({ shipment, force: true });
  return NextResponse.json({ ok: true, shipmentId: shipment.id });
});
