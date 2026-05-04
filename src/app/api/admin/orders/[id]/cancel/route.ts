import { NextResponse } from "next/server";
import { withAdmin } from "@/server/auth/admin-route";
import { cancelOrder } from "@/server/orders/service";
import { refundFull } from "@/server/refunds/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Admin-driven order cancellation. Wires the Group L `refundFull` into
 * `OrderService.cancelOrder` — when Group H landed `cancelOrder` it left
 * `refundFull` deps optional because Group L hadn't merged. Now that both
 * exist this is the production call site.
 */
export const POST = withAdmin<Ctx>(async (req, { params }, user) => {
  const { id: orderId } = await params;
  const body = (await req.json().catch(() => null)) as { reason?: string } | null;
  if (!body?.reason || body.reason.trim().length < 3) {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "reason (>= 3 chars) required" },
      { status: 400 },
    );
  }
  try {
    await cancelOrder(orderId, body.reason.trim(), user.id, {
      refundFull: async (id, reason) => {
        await refundFull(id, reason);
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "CANCEL_FAILED";
    return NextResponse.json({ error: "CONFLICT", message }, { status: 409 });
  }
});
