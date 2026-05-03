/**
 * Side-effect module: every Group D email template registers itself here so
 * the worker can look up renderers by `EmailJob.template` name. Importing this
 * file (e.g. from the worker entrypoint) populates the registry.
 */
import { createElement } from "react";
import { registerTemplate } from "@/server/email/render-template-registry";
import { renderEmail } from "@/server/email/render";

import { OrderReceipt, type OrderReceiptProps } from "./order-receipt";
import { OrderShipped, type OrderShippedProps } from "./order-shipped";
import { OrderDelivered, type OrderDeliveredProps } from "./order-delivered";
import { OrderCancelled, type OrderCancelledProps } from "./order-cancelled";

registerTemplate("OrderReceipt", async (payload) => {
  const p = payload as OrderReceiptProps;
  const { html, text } = await renderEmail(createElement(OrderReceipt, p));
  return { subject: `Order ${p.orderNumber} confirmed`, html, text };
});

registerTemplate("OrderShipped", async (payload) => {
  const p = payload as OrderShippedProps;
  const { html, text } = await renderEmail(createElement(OrderShipped, p));
  return { subject: `Your order ${p.orderNumber} is on the way`, html, text };
});

registerTemplate("OrderDelivered", async (payload) => {
  const p = payload as OrderDeliveredProps;
  const { html, text } = await renderEmail(createElement(OrderDelivered, p));
  return { subject: `Your order ${p.orderNumber} has arrived`, html, text };
});

registerTemplate("OrderCancelled", async (payload) => {
  const p = payload as OrderCancelledProps;
  const { html, text } = await renderEmail(createElement(OrderCancelled, p));
  return { subject: `Your order ${p.orderNumber} has been cancelled`, html, text };
});
