import type { OrderStatus } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { assertTransition } from './state-machine';

/**
 * Move an Order to a new status. Validated against the state machine in
 * {@link assertTransition}. Writes an `OrderStatusEvent` row in the same
 * transaction. Same-state calls are a no-op (no event written).
 */
export async function updateStatus(
  orderId: string,
  to: OrderStatus,
  note?: string,
): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error(`Order ${orderId} not found`);
  if (order.status === to) return;
  assertTransition(order.status, to);
  await prisma.$transaction([
    prisma.order.update({ where: { id: orderId }, data: { status: to } }),
    prisma.orderStatusEvent.create({
      data: { orderId, status: to, note: note ?? null },
    }),
  ]);
}
