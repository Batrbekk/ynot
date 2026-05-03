import { NextResponse } from "next/server";
import { ForgotPasswordRequestSchema } from "@/lib/schemas";
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
  const parsed = ForgotPasswordRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 422 });
  }

  const rl = await checkRateLimit({
    key: `forgot:email:${parsed.data.email}`,
    windowMs: 60 * 60_000,
    max: 3,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMIT" },
      { status: 429, headers: { "Retry-After": Math.ceil(rl.retryAfterMs / 1000).toString() } },
    );
  }

  // Always 200 regardless of whether the email exists, to prevent account
  // enumeration. We only send the email if the user is real and verified.
  const user = await findUserByEmail(parsed.data.email);
  if (user && user.emailVerifiedAt) {
    const code = await issueVerificationToken("reset", parsed.data.email);
    const text = [
      "We received a request to reset your YNOT password.",
      "",
      `Your reset code is: ${code}`,
      "",
      "This code expires in 15 minutes.",
      "If you did not request a password reset, you can safely ignore this email.",
    ].join("\n");
    await getEmailService().send({
      to: parsed.data.email,
      subject: "Reset your YNOT password",
      html: `<p>${text.replace(/\n/g, "<br>")}</p>`,
      text,
    });
  }

  return NextResponse.json({ ok: true });
}
