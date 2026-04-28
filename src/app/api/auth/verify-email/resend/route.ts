import { NextResponse } from "next/server";
import { ResendVerifyRequestSchema } from "@/lib/schemas";
import { assertCsrf } from "@/server/auth/csrf";
import { issueVerificationToken } from "@/server/auth/codes";
import { findUserByEmail } from "@/server/repositories/user.repo";
import { checkRateLimit } from "@/server/auth/rate-limit";
import { getEmailService } from "@/server/email";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    await assertCsrf();
  } catch {
    return NextResponse.json({ error: "INVALID_CSRF" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ResendVerifyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 422 });
  }

  const rl = await checkRateLimit({
    key: `resend-verify:email:${parsed.data.email}`,
    windowMs: 5 * 60_000,
    max: 1,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMIT" },
      { status: 429, headers: { "Retry-After": Math.ceil(rl.retryAfterMs / 1000).toString() } },
    );
  }

  const user = await findUserByEmail(parsed.data.email);
  if (!user || user.emailVerifiedAt) {
    return NextResponse.json({ error: "NO_PENDING_VERIFICATION" }, { status: 404 });
  }

  const code = await issueVerificationToken("verify", parsed.data.email);
  await getEmailService().sendVerificationCode(parsed.data.email, code);

  return NextResponse.json({ ok: true });
}
