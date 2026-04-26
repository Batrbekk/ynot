import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import type { Order } from "@/lib/schemas";
import { formatPrice } from "@/lib/format";
import { OrderStatusBadge } from "./order-status-badge";
import { Display } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";

const trackingUrl = (carrier: Order["carrier"], tracking: string | null) => {
  if (!tracking) return null;
  return carrier === "royal-mail"
    ? `https://www.royalmail.com/track-your-item#/tracking-results/${tracking}`
    : `https://www.dhl.com/en/express/tracking.html?AWB=${tracking}`;
};

export function OrderDetailLayout({ order }: { order: Order }) {
  const date = new Date(order.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const carrierLabel =
    order.carrier === "royal-mail"
      ? "Royal Mail — 2–3 business days"
      : "DHL — 8–10 business days";
  const tracking = trackingUrl(order.carrier, order.trackingNumber);
  const eligibleForReturn = order.status === "delivered";

  return (
    <div className="flex flex-col gap-12">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-foreground-secondary mb-2">
            Order #{order.id}
          </p>
          <Display level="md" as="h1">{date}</Display>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-4">
          Items
        </h2>
        <ul className="divide-y divide-border-light">
          {order.items.map((item) => (
            <li key={`${item.productId}-${item.size}`} className="flex gap-4 py-5">
              <div className="relative h-24 w-20 flex-shrink-0 bg-surface-secondary">
                <Image src={item.image} alt={item.name} fill sizes="80px" className="object-cover" />
              </div>
              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <p className="text-[14px] font-medium">{item.name}</p>
                  <p className="text-[12px] text-foreground-secondary">
                    {item.colour} · Size {item.size} · Qty {item.quantity}
                  </p>
                </div>
                <p className="text-[14px]">{formatPrice(item.unitPrice * item.quantity, "GBP")}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex justify-between border-t border-border-light pt-4 text-[14px] font-semibold">
          <span>Total</span>
          <span>{formatPrice(order.total, "GBP")}</span>
        </div>
      </section>

      <div className="grid gap-12 md:grid-cols-2">
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-4">
            Shipping address
          </h2>
          <p className="text-[13px] leading-relaxed">
            {order.shippingAddress.firstName} {order.shippingAddress.lastName}<br />
            {order.shippingAddress.line1}<br />
            {order.shippingAddress.line2 && (<>{order.shippingAddress.line2}<br /></>)}
            {order.shippingAddress.city}, {order.shippingAddress.postcode}<br />
            {order.shippingAddress.country}
          </p>
        </section>

        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-4">
            Shipping method
          </h2>
          <p className="text-[13px]">{carrierLabel}</p>
          {tracking ? (
            <a
              href={tracking}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-[12px] uppercase tracking-[0.15em] underline hover:no-underline"
            >
              Track shipment ({order.trackingNumber})
            </a>
          ) : (
            <p className="mt-3 text-[12px] text-foreground-secondary">
              Tracking number will appear here once the order ships.
            </p>
          )}
          <p className="mt-4 text-[12px] text-foreground-secondary">
            Estimated delivery: <span className="text-foreground-primary">{order.estimatedDeliveryDate}</span>
          </p>
        </section>
      </div>

      {eligibleForReturn && (
        <div className="border-t border-border-light pt-8 flex justify-end">
          <Link href="/initiate-return">
            <Button variant="outline">Initiate a return</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
