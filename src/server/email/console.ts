import type { EmailService } from "./types";

function format(kind: string, email: string, code: string): string {
  const lines = [
    "",
    "══════════════════════════════════════════════",
    ` [ynot dev email] ${kind}`,
    ` To:    ${email}`,
    ` Code:  ${code}`,
    " (Expires in 15 minutes)",
    "══════════════════════════════════════════════",
    "",
  ];
  return lines.join("\n");
}

/**
 * Dev / smoke-test fallback. Emits the verification code to stderr so the
 * developer can copy-paste it into the verification UI without a real email
 * service.
 */
export class ConsoleEmailService implements EmailService {
  async sendVerificationCode(email: string, code: string): Promise<void> {
    process.stderr.write(format("Verification code", email, code));
  }

  async sendPasswordResetCode(email: string, code: string): Promise<void> {
    process.stderr.write(format("Reset password code", email, code));
  }
}
