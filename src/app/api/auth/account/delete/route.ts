import { NextResponse } from "next/server";
import { DeleteAccountRequestSchema } from "@/lib/schemas";
import { assertCsrf } from "@/server/auth/csrf";
import { requireSessionUser } from "@/server/auth/session";
import { softDeleteUser } from "@/server/repositories/user.repo";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request): Promise<NextResponse> {
  try {
    await assertCsrf();
    const session = await requireSessionUser();
    const body = await req.json().catch(() => null);
    const parsed = DeleteAccountRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 422 });
    }
    if (parsed.data.confirmEmail !== session.email) {
      return NextResponse.json({ error: "EMAIL_MISMATCH" }, { status: 422 });
    }
    await softDeleteUser(session.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json({ error: e.message ?? "ERROR" }, { status: e.status ?? 500 });
  }
}
