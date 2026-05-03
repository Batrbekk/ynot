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
import {
  ReturnInstructionsUk,
  type ReturnInstructionsUkProps,
} from "./return-instructions-uk";
import {
  ReturnInstructionsInternational,
  type ReturnInstructionsInternationalProps,
} from "./return-instructions-international";
import { RefundIssued, type RefundIssuedProps } from "./refund-issued";
import { RefundRejected, type RefundRejectedProps } from "./refund-rejected";
import { AbandonedCart1h, type AbandonedCart1hProps } from "./abandoned-cart-1h";
import { AbandonedCart24h, type AbandonedCart24hProps } from "./abandoned-cart-24h";

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

registerTemplate("ReturnInstructionsUk", async (payload) => {
  const p = payload as ReturnInstructionsUkProps;
  const { html, text } = await renderEmail(createElement(ReturnInstructionsUk, p));
  return { subject: `Return ${p.returnNumber} — your prepaid label`, html, text };
});

registerTemplate("ReturnInstructionsInternational", async (payload) => {
  const p = payload as ReturnInstructionsInternationalProps;
  const { html, text } = await renderEmail(createElement(ReturnInstructionsInternational, p));
  return { subject: `Return ${p.returnNumber} — instructions`, html, text };
});

registerTemplate("RefundIssued", async (payload) => {
  const p = payload as RefundIssuedProps;
  const { html, text } = await renderEmail(createElement(RefundIssued, p));
  return { subject: `Refund issued for ${p.returnNumber}`, html, text };
});

registerTemplate("RefundRejected", async (payload) => {
  const p = payload as RefundRejectedProps;
  const { html, text } = await renderEmail(createElement(RefundRejected, p));
  return { subject: `Update on your return ${p.returnNumber}`, html, text };
});

registerTemplate("AbandonedCart1h", async (payload) => {
  const p = payload as AbandonedCart1hProps;
  const { html, text } = await renderEmail(createElement(AbandonedCart1h, p));
  return { subject: "You left something behind", html, text };
});

registerTemplate("AbandonedCart24h", async (payload) => {
  const p = payload as AbandonedCart24hProps;
  const { html, text } = await renderEmail(createElement(AbandonedCart24h, p));
  return { subject: "Your cart, plus 10% off", html, text };
});
