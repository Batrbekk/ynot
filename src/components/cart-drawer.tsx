"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { useCartStore } from "@/lib/stores/cart-store";
import { formatPrice } from "@/lib/format";

export function CartDrawer() {
  const isOpen = useCartStore((s) => s.isOpen);
  const close = useCartStore((s) => s.closeDrawer);
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal());
  const removeItem = useCartStore((s) => s.removeItem);
  const setQuantity = useCartStore((s) => s.setQuantity);

  return (
    <Drawer open={isOpen} onClose={close} side="right" title="Your Bag">
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-6 px-6 py-16 text-center">
          <p className="text-[14px] text-foreground-secondary">
            Your bag is empty
          </p>
          <Link href="/collection/jackets" onClick={close}>
            <Button variant="outline" size="md">
              Continue shopping
            </Button>
          </Link>
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <ul className="flex-1 divide-y divide-border-light overflow-y-auto">
            {items.map((item) => (
              <li
                key={`${item.productId}-${item.size}`}
                className="flex gap-4 p-5"
              >
                <div className="relative h-24 w-20 flex-shrink-0 bg-surface-secondary">
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col justify-between">
                  <div>
                    <p className="text-[13px] font-medium text-foreground-primary">
                      {item.name}
                    </p>
                    <p className="text-[12px] text-foreground-secondary">
                      {item.colour} · Size {item.size}
                    </p>
                    {item.preOrder && (
                      <p className="text-[11px] uppercase tracking-[0.15em] text-accent-warm mt-1">
                        Pre-order · 3 weeks
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <QuantityStepper
                      value={item.quantity}
                      onChange={(q) => setQuantity(item.productId, item.size, q)}
                      min={1}
                      max={10}
                    />
                    <p className="text-[13px] font-medium">
                      {formatPrice(item.unitPrice * item.quantity, "GBP")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.productId, item.size)}
                    className="self-start text-[11px] uppercase tracking-[0.2em] text-foreground-secondary hover:text-foreground-primary"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-border-light p-5 space-y-3">
            <div className="flex justify-between text-[13px]">
              <span className="text-foreground-secondary">Subtotal</span>
              <span className="font-medium">{formatPrice(subtotal, "GBP")}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-foreground-secondary">Shipping</span>
              <span className="font-medium">Free</span>
            </div>
            <Link href="/checkout/shipping" onClick={close} className="block">
              <Button fullWidth size="lg">
                Checkout
              </Button>
            </Link>
            <p className="text-center text-[11px] uppercase tracking-[0.2em] text-foreground-tertiary">
              Secure checkout
            </p>
          </div>
        </div>
      )}
    </Drawer>
  );
}
