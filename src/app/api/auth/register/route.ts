import { NextResponse } from "next/server";
import { RegisterRequestSchema } from "@/lib/schemas";
import { assertCsrf } from "@/server/auth/csrf";
import { hashPassword } from "@/server/auth/password";
import { issueVerificationToken } from "@/server/auth/codes";
import { createUser, findUserByEmail } from "@/server/repositories/user.repo";
import { checkRateLimit } from "@/server/auth/rate-limit";
import { getEmailService } from "@/server/email";

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
  const text = [
    "Welcome to YNOT London.",
    "",
    `Your verification code is: ${code}`,
    "",
    "This code expires in 15 minutes.",
    "If you did not request it, please ignore this email.",
  ].join("\n");
  await getEmailService().send({
    to: parsed.data.email,
    subject: "Your YNOT verification code",
    html: `<p>${text.replace(/\n/g, "<br>")}</p>`,
    text,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
