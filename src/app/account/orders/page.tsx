import * as React from "react";
import { getOrdersForCurrentUser } from "@/server/data/orders";
import { OrderListItem } from "@/components/account/order-list-item";

export default async function AccountOrdersPage() {
  const orders = await getOrdersForCurrentUser();
  if (orders.length === 0) {
    return (
      <p className="text-[14px] text-foreground-secondary py-12">
        You haven&rsquo;t placed any orders yet.
      </p>
    );
  }
  return (
    <ul className="border-t border-border-light">
      {orders.map((o) => (
        <OrderListItem key={o.id} order={o} />
      ))}
    </ul>
  );
}
