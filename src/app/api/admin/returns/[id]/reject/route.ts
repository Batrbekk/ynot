import { NextResponse } from "next/server";
import { withAdmin } from "@/server/auth/admin-route";
import { rejectReturn } from "@/server/returns/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Reject a return: marks REJECTED, captures rejection reason + inspection
 * notes, sends RefundRejected email. No stock or refund movement.
 */
export const POST = withAdmin<Ctx>(async (req, { params }, user) => {
  const { id: returnId } = await params;
  const body = (await req.json().catch(() => null)) as
    | { rejectionReason?: string; inspectionNotes?: string }
    | null;
  if (!body?.rejectionReason || body.rejectionReason.trim().length < 3) {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "rejectionReason (>= 3 chars) required" },
      { status: 400 },
    );
  }
  if (!body.inspectionNotes || body.inspectionNotes.trim().length < 3) {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "inspectionNotes (>= 3 chars) required" },
      { status: 400 },
    );
  }
  try {
    const updated = await rejectReturn(returnId, {
      rejectionReason: body.rejectionReason.trim(),
      inspectionNotes: body.inspectionNotes.trim(),
      actorId: user.id,
    });
    return NextResponse.json({ ok: true, returnId: updated.id, status: updated.status });
  } catch (e) {
    const message = e instanceof Error ? e.message : "REJECT_FAILED";
    return NextResponse.json({ error: "CONFLICT", message }, { status: 409 });
  }
});
