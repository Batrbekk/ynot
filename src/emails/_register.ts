/**
 * Side-effect module: every Group D email template registers itself here so
 * the worker can look up renderers by `EmailJob.template` name. Importing this
 * file (e.g. from the worker entrypoint) populates the registry.
 */
import { createElement } from "react";
import { registerTemplate } from "@/server/email/render-template-registry";
import { renderEmail } from "@/server/email/render";

import { OrderReceipt, type OrderReceiptProps } from "./order-receipt";

registerTemplate("OrderReceipt", async (payload) => {
  const p = payload as OrderReceiptProps;
  const { html, text } = await renderEmail(createElement(OrderReceipt, p));
  return { subject: `Order ${p.orderNumber} confirmed`, html, text };
});
