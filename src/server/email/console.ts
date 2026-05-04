import type { EmailService, SendEmailInput } from "./types";

/**
 * Dev / smoke-test fallback. Emits the email envelope to stderr so a developer
 * can copy-paste codes / verify content without a real email service.
 */
export class ConsoleEmailService implements EmailService {
  async send(input: SendEmailInput): Promise<{ id: string }> {
    const id = `console-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    process.stderr.write(`[email/console] ─────────────────────────────\n`);
    process.stderr.write(`[email/console] To: ${input.to}\n`);
    process.stderr.write(`[email/console] Subject: ${input.subject}\n`);
    process.stderr.write(`[email/console] Text:\n${input.text}\n`);
    if (input.attachments?.length) {
      for (const a of input.attachments) {
        process.stderr.write(
          `[email/console] Attachment: ${a.filename} (${a.content.byteLength} bytes)\n`,
        );
      }
    }
    process.stderr.write(`[email/console] id=${id}\n`);
    return { id };
  }
}
