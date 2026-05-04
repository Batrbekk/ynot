import type { ReactElement } from "react";
import type { EmailService, SendEmailAttachment } from "./types";
import { renderEmail } from "./render";

export interface SendTemplatedEmailInput {
  service: EmailService;
  to: string;
  subject: string;
  component: ReactElement;
  attachments?: SendEmailAttachment[];
}

/**
 * Renders the JSX component into HTML+text and dispatches via the configured
 * EmailService. Higher-level helper for app code that doesn't want to call
 * `renderEmail` then `service.send` separately.
 */
export async function sendTemplatedEmail(
  input: SendTemplatedEmailInput,
): Promise<{ id: string }> {
  const { html, text } = await renderEmail(input.component);
  return input.service.send({
    to: input.to,
    subject: input.subject,
    html,
    text,
    attachments: input.attachments,
  });
}
