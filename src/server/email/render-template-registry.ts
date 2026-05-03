export interface RenderedTemplate {
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: Buffer }[];
}

/**
 * Stub registry. Replaced in Task 21 with the real `registerTemplate` /
 * `renderTemplate` pair backed by an in-process map.
 */
export async function renderTemplate(
  _name: string,
  _payload: unknown,
): Promise<RenderedTemplate> {
  throw new Error("renderTemplate not yet wired — see Task 21");
}
