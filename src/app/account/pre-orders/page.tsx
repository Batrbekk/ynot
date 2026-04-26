import * as React from "react";
import { getOrdersForCurrentUser } from "@/lib/data/orders";
import { OrderListItem } from "@/components/account/order-list-item";

export default async function AccountPreOrdersPage() {
  const orders = await getOrdersForCurrentUser();
  const preOrders = orders.filter((o) => o.items.some((i) => i.preOrder));
  if (preOrders.length === 0) {
    return (
      <p className="text-[14px] text-foreground-secondary py-12">
        You don&rsquo;t have any active pre-orders. Pre-order items will appear
        here with their estimated ship date.
      </p>
    );
  }
  return (
    <ul className="border-t border-border-light">
      {preOrders.map((o) => (
        <OrderListItem key={o.id} order={o} />
      ))}
    </ul>
  );
}
