"use client";

import * as React from "react";
import Image from "next/image";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import type { Order } from "@/lib/schemas";

export interface ReturnItemsSelectorProps {
  order: Order;
  selectedKeys: string[];
  reason: string;
  onToggle: (key: string) => void;
  onReasonChange: (reason: string) => void;
  onSubmit: () => void;
}

const itemKey = (i: { productId: string; size: string }) => `${i.productId}-${i.size}`;

export function ReturnItemsSelector({
  order,
  selectedKeys,
  reason,
  onToggle,
  onReasonChange,
  onSubmit,
}: ReturnItemsSelectorProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedKeys.length === 0 || !reason.trim()) return;
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <div>
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.2em] text-foreground-secondary mb-4">
          Order #{order.id}
        </h2>
        <ul className="divide-y divide-border-light border-y border-border-light">
          {order.items.map((item) => {
            const key = itemKey(item);
            return (
              <li key={key} className="flex gap-4 py-4 items-center">
                <Checkbox
                  label=""
                  checked={selectedKeys.includes(key)}
                  onChange={() => onToggle(key)}
                />
                <div className="relative h-20 w-16 flex-shrink-0 bg-surface-secondary">
                  <Image src={item.image} alt={item.name} fill sizes="64px" className="object-cover" />
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-medium">{item.name}</p>
                  <p className="text-[12px] text-foreground-secondary">
                    {item.colour} · Size {item.size} · Qty {item.quantity}
                  </p>
                </div>
                <p className="text-[14px]">{formatPrice(item.unitPrice * item.quantity, "GBP")}</p>
              </li>
            );
          })}
        </ul>
      </div>

      <Textarea
        label="Reason for return"
        placeholder="Tell us why you're returning these items..."
        value={reason}
        onChange={(e) => onReasonChange(e.target.value)}
        required
        rows={4}
      />

      <Button type="submit" size="lg" fullWidth disabled={selectedKeys.length === 0 || !reason.trim()}>
        Continue
      </Button>
    </form>
  );
}
