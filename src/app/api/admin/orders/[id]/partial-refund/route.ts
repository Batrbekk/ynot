import { NextResponse } from "next/server";
import { withAdmin } from "@/server/auth/admin-route";
import { refundPartialItems } from "@/server/refunds/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

interface RequestItem { orderItemId: string; quantity: number }

/**
 * Refund a custom subset of items on the order via Stripe + restock. Body:
 *   { items: [{ orderItemId, quantity }, ...] }
 *
 * The refund amount is computed server-side (sum of OrderItem.unitPriceCents
 * × qty) so the operator can't accidentally inflate it. Errors from
 * `refundPartialItems` (Group L) — over-refund, no payment, missing item —
 * propagate to a 409 envelope.
 */
export const POST = withAdmin<Ctx>(async (req, { params }, user) => {
  const { id: orderId } = await params;
  const body = (await req.json().catch(() => null)) as { items?: RequestItem[] } | null;
  if (!body?.items || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "items[] required" },
      { status: 400 },
    );
  }
  for (const it of body.items) {
    if (!it.orderItemId || !Number.isInteger(it.quantity) || it.quantity < 1) {
      return NextResponse.json(
        { error: "INVALID_ITEM", message: "each item needs orderItemId + integer qty >= 1" },
        { status: 400 },
      );
    }
  }
  try {
    const result = await refundPartialItems(
      orderId,
      body.items,
      `admin:${user.id}`,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "REFUND_FAILED";
    return NextResponse.json({ error: "CONFLICT", message }, { status: 409 });
  }
});
