import { Resend } from "resend";
import type { EmailService, SendEmailInput } from "./types";

/**
 * Production email service backed by Resend. Accepts the unified
 * `SendEmailInput` shape (subject + html + text + optional attachments).
 */
export class ResendEmailService implements EmailService {
  private client: Resend;
  private from: string;

  constructor(apiKey: string, from: string) {
    this.client = new Resend(apiKey);
    this.from = from;
  }

  async send(input: SendEmailInput): Promise<{ id: string }> {
    const result = await this.client.emails.send({
      from: this.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      attachments: input.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
    });
    if (result.error) {
      throw new Error(`Resend error: ${result.error.message}`);
    }
    return { id: result.data!.id };
  }
}
