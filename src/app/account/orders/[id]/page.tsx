import { notFound } from "next/navigation";
import { getCustomerOrderById } from "@/server/data/customer-orders";
import { OrderDetailWithShipments } from "@/components/account/order-detail-with-shipments";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Customer-facing order detail page (Phase 5 task 96).
 *
 * Loads the order with its shipments + status events via
 * {@link getCustomerOrderById}, which handles dual-mode auth (signed-in
 * session OR `__ynot_order_token` HMAC cookie). Renders shipments with
 * carrier tracking URLs and a chronological status timeline.
 */
export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const order = await getCustomerOrderById(id);
  if (!order) notFound();
  return <OrderDetailWithShipments order={order} />;
}
