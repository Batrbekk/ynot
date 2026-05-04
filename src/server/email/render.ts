import { render } from "@react-email/render";
import type { ReactElement } from "react";

export interface RenderedEmail {
  html: string;
  text: string;
}

/**
 * Render a React Email JSX element into both HTML and plain-text variants.
 * Server-only — relies on @react-email/render's node entry.
 */
export async function renderEmail(component: ReactElement): Promise<RenderedEmail> {
  const html = await render(component);
  const text = await render(component, { plainText: true });
  return { html, text };
}
