import { NextResponse } from "next/server";
import { ChangePasswordRequestSchema } from "@/lib/schemas";
import { prisma } from "@/server/db/client";
import { assertCsrf } from "@/server/auth/csrf";
import { requireSessionUser } from "@/server/auth/session";
import { hashPassword, verifyPassword } from "@/server/auth/password";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request): Promise<NextResponse> {
  try {
    await assertCsrf();
    const session = await requireSessionUser();
    const body = await req.json().catch(() => null);
    const parsed = ChangePasswordRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 422 });
    }
    const current = await prisma.user.findUnique({ where: { id: session.id } });
    if (!current?.passwordHash) {
      return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
    }
    const ok = await verifyPassword(parsed.data.currentPassword, current.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
    }
    const newHash = await hashPassword(parsed.data.newPassword);
    await prisma.user.update({
      where: { id: session.id },
      data: { passwordHash: newHash },
    });
    await prisma.session.deleteMany({ where: { userId: session.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json({ error: e.message ?? "ERROR" }, { status: e.status ?? 500 });
  }
}
