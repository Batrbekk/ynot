import * as React from "react";
import Link from "next/link";
import type { Order } from "@/lib/schemas";
import { formatPrice } from "@/lib/format";
import { OrderStatusBadge } from "./order-status-badge";

export function OrderListItem({ order }: { order: Order }) {
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);
  const date = new Date(order.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <li className="border-b border-border-light py-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] uppercase tracking-[0.2em] text-foreground-secondary">
            Order #{order.id}
          </p>
          <p className="text-[14px] text-foreground-primary">
            {date} · {itemCount} {itemCount === 1 ? "item" : "items"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <OrderStatusBadge status={order.status} />
          <p className="text-[14px] font-medium">{formatPrice(order.total, "GBP")}</p>
          <Link
            href={`/account/orders/${order.id}`}
            className="text-[12px] uppercase tracking-[0.15em] underline hover:no-underline"
          >
            View details
          </Link>
        </div>
      </div>
    </li>
  );
}
