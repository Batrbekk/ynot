import * as React from 'react';
import type { OrderStatus } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { sendTemplatedEmail } from '@/server/email/send';
import { getEmailService } from '@/server/email';
import type { EmailService } from '@/server/email';
import { OrderCancelled } from '@/emails/order-cancelled';
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

export interface CancelOrderDeps {
  /**
   * Refund the order in full via Stripe. Defaults to the real
   * `RefundService.refundFull` once Group L lands; tests inject a mock.
   * Optional because Group L (Task 68) hasn't been merged yet — production
   * call sites pass the real implementation explicitly.
   */
  refundFull?: (orderId: string, reason: string) => Promise<void>;
  /** Override the email transport; defaults to `getEmailService()`. */
  emailService?: EmailService;
}

const CANCELLABLE: OrderStatus[] = ['NEW', 'PROCESSING', 'PARTIALLY_SHIPPED'];

/**
 * Admin cancel: terminate an order pre-despatch.
 *
 * - Marks every un-shipped Shipment `cancelledAt = now`.
 * - Restocks every OrderItem (reverses Phase 4's checkout decrement).
 * - Transitions Order → CANCELLED + OrderStatusEvent (`admin:<actorId>: <reason>`).
 * - Refunds the captured Payment in full (best-effort; deps-injected so the
 *   site test can pass before Group L exists).
 * - Sends an OrderCancelled email if the customer has a usable address.
 *
 * Throws if the order isn't in a cancellable status. Once SHIPPED, use the
 * returns flow instead — recall is irreversible.
 */
export async function cancelOrder(
  orderId: string,
  reason: string,
  actorId: string,
  deps: CancelOrderDeps = {},
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, shipments: true, user: true, payment: true },
  });
  if (!order) throw new Error(`Order ${orderId} not found`);
  if (!CANCELLABLE.includes(order.status)) {
    throw new Error(
      `Cannot cancel order ${order.orderNumber} in status ${order.status}`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.shipment.updateMany({
      where: { orderId, shippedAt: null, cancelledAt: null },
      data: { cancelledAt: new Date() },
    });
    for (const item of order.items) {
      if (!item.productId) continue;
      await tx.productSize.update({
        where: { productId_size: { productId: item.productId, size: item.size } },
        data: { stock: { increment: item.quantity } },
      });
    }
    await tx.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } });
    await tx.orderStatusEvent.create({
      data: { orderId, status: 'CANCELLED', note: `admin:${actorId}: ${reason}` },
    });
  });

  if (order.payment && order.payment.status === 'CAPTURED' && deps.refundFull) {
    await deps.refundFull(order.id, 'admin_cancel');
  }

  const recipient = order.user?.email ?? null;
  if (recipient) {
    const emailService = deps.emailService ?? getEmailService();
    await sendTemplatedEmail({
      service: emailService,
      to: recipient,
      subject: `Your order ${order.orderNumber} has been cancelled`,
      component: React.createElement(OrderCancelled, {
        orderNumber: order.orderNumber,
        customerName: order.shipFirstName,
        refundAmountCents: order.totalCents,
        refundEtaDays: 3,
        reasonShort: reason,
      }),
    });
  }
}
