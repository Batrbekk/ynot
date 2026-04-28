import { Resend } from "resend";
import type { EmailService } from "./types";

/**
 * Production email service backed by Resend. Plain-text bodies in this phase;
 * Phase 5 swaps in branded HTML templates.
 */
export class ResendEmailService implements EmailService {
  private client: Resend;
  private from: string;

  constructor(apiKey: string, from: string) {
    this.client = new Resend(apiKey);
    this.from = from;
  }

  private async send(to: string, subject: string, text: string): Promise<void> {
    const result = await this.client.emails.send({ from: this.from, to, subject, text });
    if (result.error) {
      throw new Error(`Resend error: ${result.error.message}`);
    }
  }

  async sendVerificationCode(email: string, code: string): Promise<void> {
    const text = [
      "Welcome to YNOT London.",
      "",
      `Your verification code is: ${code}`,
      "",
      "This code expires in 15 minutes.",
      "If you did not request it, please ignore this email.",
    ].join("\n");
    await this.send(email, "Your YNOT verification code", text);
  }

  async sendPasswordResetCode(email: string, code: string): Promise<void> {
    const text = [
      "We received a request to reset your YNOT password.",
      "",
      `Your reset code is: ${code}`,
      "",
      "This code expires in 15 minutes.",
      "If you did not request a password reset, you can safely ignore this email.",
    ].join("\n");
    await this.send(email, "Reset your YNOT password", text);
  }
}
