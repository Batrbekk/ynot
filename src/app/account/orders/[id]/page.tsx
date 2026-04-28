import { notFound } from "next/navigation";
import { getOrderById } from "@/server/data/orders";
import { OrderDetailLayout } from "@/components/account/order-detail-layout";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();
  return <OrderDetailLayout order={order} />;
}
