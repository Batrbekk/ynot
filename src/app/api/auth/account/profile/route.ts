import { NextResponse } from "next/server";
import { UpdateProfileRequestSchema } from "@/lib/schemas";
import { prisma } from "@/server/db/client";
import { assertCsrf } from "@/server/auth/csrf";
import { getSessionUser, requireSessionUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    emailVerifiedAt: user.emailVerifiedAt,
  });
}

export async function PATCH(req: Request): Promise<NextResponse> {
  try {
    await assertCsrf();
    const session = await requireSessionUser();
    const body = await req.json().catch(() => null);
    const parsed = UpdateProfileRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 422 });
    }
    await prisma.user.update({
      where: { id: session.id },
      data: { name: parsed.data.name },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json({ error: e.message ?? "ERROR" }, { status: e.status ?? 500 });
  }
}
