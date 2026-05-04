export interface RenderedTemplate {
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: Buffer }[];
}
