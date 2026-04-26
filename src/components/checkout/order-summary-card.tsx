"use client";

import * as React from "react";
import Image from "next/image";
import { useCartStore } from "@/lib/stores/cart-store";
import { formatPrice } from "@/lib/format";

export function OrderSummaryCard() {
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal());

  return (
    <aside className="border border-border-light p-6 bg-surface-primary">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-4">
        Order summary
      </h3>
      <ul className="divide-y divide-border-light">
        {items.map((item) => (
          <li key={`${item.productId}-${item.size}`} className="flex gap-4 py-4">
            <div className="relative h-20 w-16 flex-shrink-0 bg-surface-secondary">
              <Image src={item.image} alt={item.name} fill sizes="64px" className="object-cover" />
            </div>
            <div className="flex flex-1 flex-col justify-between">
              <p className="text-[13px] font-medium">{item.name}</p>
              <p className="text-[12px] text-foreground-secondary">
                Size {item.size} · Qty {item.quantity}
              </p>
              <p className="text-[13px]">{formatPrice(item.unitPrice * item.quantity, "GBP")}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 space-y-2 border-t border-border-light pt-4 text-[13px]">
        <div className="flex justify-between">
          <span className="text-foreground-secondary">Subtotal</span>
          <span>{formatPrice(subtotal, "GBP")}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-foreground-secondary">Shipping</span>
          <span>Free</span>
        </div>
        <div className="flex justify-between border-t border-border-light pt-2 font-semibold">
          <span>Total</span>
          <span>{formatPrice(subtotal, "GBP")}</span>
        </div>
      </div>
    </aside>
  );
}
