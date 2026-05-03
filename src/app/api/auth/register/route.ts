import { createElement } from "react";
import { NextResponse } from "next/server";
import { RegisterRequestSchema } from "@/lib/schemas";
import { assertCsrf } from "@/server/auth/csrf";
import { hashPassword } from "@/server/auth/password";
import { issueVerificationToken } from "@/server/auth/codes";
import { createUser, findUserByEmail } from "@/server/repositories/user.repo";
import { checkRateLimit } from "@/server/auth/rate-limit";
import { getEmailService } from "@/server/email";
import { sendTemplatedEmail } from "@/server/email/send";
import { VerifyEmail } from "@/emails/verify-email";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    await assertCsrf();
  } catch {
    return NextResponse.json({ error: "INVALID_CSRF" }, { status: 403 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const rl = await checkRateLimit({ key: `register:ip:${ip}`, windowMs: 60 * 60_000, max: 3 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMIT" },
      { status: 429, headers: { "Retry-After": Math.ceil(rl.retryAfterMs / 1000).toString() } },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = RegisterRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 422 });
  }

  const existing = await findUserByEmail(parsed.data.email);
  if (existing) {
    return NextResponse.json({ error: "EMAIL_TAKEN" }, { status: 409 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await createUser({
    email: parsed.data.email,
    passwordHash,
    name: parsed.data.name,
  });

  const code = await issueVerificationToken("verify", parsed.data.email);
  await sendTemplatedEmail({
    service: getEmailService(),
    to: parsed.data.email,
    subject: "Verify your email — YNOT London",
    component: createElement(VerifyEmail, {
      customerName: parsed.data.name,
      verificationCode: code,
      expiresInMinutes: 15,
    }),
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
