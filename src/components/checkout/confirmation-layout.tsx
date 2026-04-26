import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Display } from "@/components/ui/typography";
import { CheckoutProgress } from "./checkout-progress";
import { formatPrice } from "@/lib/format";
import type { Order } from "@/lib/schemas";

export function ConfirmationLayout({ order }: { order: Order }) {
  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col items-center text-center">
        <Display level="lg" as="h1">Thank you for your order</Display>
        <p className="mt-3 text-[13px] uppercase tracking-[0.2em] text-foreground-secondary">
          Order #{order.id}
        </p>
        <p className="mt-3 max-w-md text-[14px] text-foreground-secondary">
          A confirmation email has been sent to your email address. We&rsquo;ll let you know when your order ships.
        </p>
      </div>

      <CheckoutProgress current={3} />

      <div className="grid gap-12 md:grid-cols-2">
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-4">
            Order details
          </h3>
          <ul className="divide-y divide-border-light">
            {order.items.map((item) => (
              <li key={`${item.productId}-${item.size}`} className="flex justify-between py-3 text-[13px]">
                <span>
                  {item.name} <span className="text-foreground-secondary">· Size {item.size} · Qty {item.quantity}</span>
                </span>
                <span>{formatPrice(item.unitPrice * item.quantity, "GBP")}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t border-border-light pt-4 text-[14px] font-semibold">
            <span>Total</span>
            <span>{formatPrice(order.total, "GBP")}</span>
          </div>
        </section>

        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-4">
            Shipping details
          </h3>
          <p className="text-[13px] leading-relaxed">
            {order.shippingAddress.firstName} {order.shippingAddress.lastName}<br />
            {order.shippingAddress.line1}<br />
            {order.shippingAddress.line2 && (<>{order.shippingAddress.line2}<br /></>)}
            {order.shippingAddress.city}, {order.shippingAddress.postcode}<br />
            {order.shippingAddress.country}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 text-[13px]">
            <div>
              <p className="text-foreground-secondary">Shipping method</p>
              <p>{order.carrier === "royal-mail" ? "Royal Mail — 2–3 business days" : "DHL — 8–10 business days"}</p>
            </div>
            <div>
              <p className="text-foreground-secondary">Estimated delivery</p>
              <p>{order.estimatedDeliveryDate}</p>
            </div>
          </div>
        </section>
      </div>

      <div className="flex justify-center">
        <Link href="/">
          <Button size="lg">Continue shopping</Button>
        </Link>
      </div>
    </div>
  );
}
