export interface SendEmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: SendEmailAttachment[];
}

export interface EmailService {
  send(input: SendEmailInput): Promise<{ id: string }>;
}
