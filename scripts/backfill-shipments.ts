import { prisma } from '../src/server/db/client';

const ELIGIBLE_STATUSES = [
  'NEW',
  'PROCESSING',
  'PARTIALLY_SHIPPED',
  'SHIPPED',
  'PARTIALLY_DELIVERED',
  'DELIVERED',
  'RETURNED',
] as const;

export interface BackfillResult {
  ordersProcessed: number;
  shipmentsCreated: number;
  itemsLinked: number;
}

export async function backfillShipments(): Promise<BackfillResult> {
  const orders = await prisma.order.findMany({
    where: { status: { in: ELIGIBLE_STATUSES as unknown as never[] } },
    include: { items: true, shipments: true },
  });

  let shipmentsCreated = 0;
  let itemsLinked = 0;

  for (const order of orders) {
    if (order.shipments.length > 0) continue; // idempotent

    const shipment = await prisma.shipment.create({
      data: {
        orderId: order.id,
        carrier: order.carrier,
        trackingNumber: order.trackingNumber,
        shippedAt:
          order.status === 'SHIPPED' ||
          order.status === 'DELIVERED' ||
          order.status === 'RETURNED'
            ? order.updatedAt
            : null,
        deliveredAt:
          order.status === 'DELIVERED' || order.status === 'RETURNED'
            ? order.updatedAt
            : null,
        labelGeneratedAt: order.trackingNumber ? order.createdAt : null,
      },
    });
    shipmentsCreated++;

    const update = await prisma.orderItem.updateMany({
      where: { orderId: order.id },
      data: { shipmentId: shipment.id },
    });
    itemsLinked += update.count;
  }

  return { ordersProcessed: orders.length, shipmentsCreated, itemsLinked };
}

if (require.main === module) {
  backfillShipments()
    .then((r) => {
      console.log('Backfill complete:', r);
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
