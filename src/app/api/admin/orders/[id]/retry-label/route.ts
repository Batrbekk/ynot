import { NextResponse } from "next/server";
import { withAdmin } from "@/server/auth/admin-route";
import { prisma } from "@/server/db/client";
import { buildDeps } from "@/server/fulfilment/deps";
import { env } from "@/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Retry label creation for every Shipment on the order with
 * `labelGeneratedAt = null`. Resets `attemptCount` first so the give-up
 * heuristic restarts; the operator is in the loop now.
 *
 * Returns `{ tried, succeeded }` — the UI surfaces a count of successes vs
 * failures so the operator knows whether to fall back to manual override.
 */
export const POST = withAdmin<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const shipments = await prisma.shipment.findMany({
    where: { orderId: id, labelGeneratedAt: null, cancelledAt: null },
  });

  // Reset attemptCount so an operator-driven retry doesn't insta-give-up.
  await prisma.shipment.updateMany({
    where: { id: { in: shipments.map((s) => s.id) } },
    data: { attemptCount: 0, lastAttemptError: null },
  });

  const deps = buildDeps(env);
  let succeeded = 0;
  for (const s of shipments) {
    const result = await deps.tryCreateShipment(s.id);
    if (result.ok) succeeded += 1;
  }

  return NextResponse.json({ tried: shipments.length, succeeded });
});
