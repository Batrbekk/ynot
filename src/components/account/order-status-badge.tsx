import * as React from "react";
import { cn } from "@/lib/cn";
import type { OrderStatus } from "@/lib/schemas";

const palette: Record<OrderStatus, string> = {
  new: "bg-surface-secondary text-foreground-on-cream",
  processing: "bg-accent-warm/20 text-accent-warm",
  shipped: "bg-foreground-primary text-foreground-inverse",
  delivered: "bg-success/15 text-success",
  returned: "bg-error/15 text-error",
};

const labels: Record<OrderStatus, string> = {
  new: "New",
  processing: "Processing",
  shipped: "In transit",
  delivered: "Delivered",
  returned: "Returned",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em]",
        palette[status],
      )}
    >
      {labels[status]}
    </span>
  );
}
