import { NextResponse } from "next/server";
import { withAdmin } from "@/server/auth/admin-route";
import { approveReturn } from "@/server/returns/service";
import { refundForReturn } from "@/server/refunds/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Approve a return: refunds the accepted items via Stripe (`refundForReturn`),
 * marks the Return APPROVED, sends RefundIssued email. Wires Group L's
 * `refundForReturn` as the deps-injected refund callback.
 */
export const POST = withAdmin<Ctx>(async (req, { params }, user) => {
  const { id: returnId } = await params;
  const body = (await req.json().catch(() => null)) as
    | { acceptedItemIds?: string[]; inspectionNotes?: string }
    | null;
  if (!body?.acceptedItemIds || !Array.isArray(body.acceptedItemIds) || body.acceptedItemIds.length === 0) {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "acceptedItemIds (non-empty array) required" },
      { status: 400 },
    );
  }
  try {
    const updated = await approveReturn(
      returnId,
      {
        acceptedItemIds: body.acceptedItemIds,
        ...(body.inspectionNotes ? { inspectionNotes: body.inspectionNotes } : {}),
        actorId: user.id,
      },
      { refundForReturn },
    );
    return NextResponse.json({ ok: true, returnId: updated.id, status: updated.status });
  } catch (e) {
    const message = e instanceof Error ? e.message : "APPROVE_FAILED";
    return NextResponse.json({ error: "CONFLICT", message }, { status: 409 });
  }
});
