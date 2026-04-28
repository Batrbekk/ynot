import { NextResponse } from "next/server";
import { VerifyEmailRequestSchema } from "@/lib/schemas";
import { assertCsrf } from "@/server/auth/csrf";
import { consumeVerificationToken } from "@/server/auth/codes";
import { findUserByEmail, markEmailVerified } from "@/server/repositories/user.repo";
import { checkRateLimit } from "@/server/auth/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    await assertCsrf();
  } catch {
    return NextResponse.json({ error: "INVALID_CSRF" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = VerifyEmailRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 422 });
  }

  const rl = await checkRateLimit({
    key: `verify:email:${parsed.data.email}`,
    windowMs: 15 * 60_000,
    max: 5,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMIT" },
      { status: 429, headers: { "Retry-After": Math.ceil(rl.retryAfterMs / 1000).toString() } },
    );
  }

  const ok = await consumeVerificationToken("verify", parsed.data.email, parsed.data.code);
  if (!ok) {
    return NextResponse.json({ error: "INVALID_CODE" }, { status: 401 });
  }

  const user = await findUserByEmail(parsed.data.email);
  if (!user) {
    return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
  }
  await markEmailVerified(user.id);

  return NextResponse.json({ ok: true });
}
