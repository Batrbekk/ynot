import { prisma } from '@/server/db/client';
import { stripe } from '@/server/checkout/stripe';
import { updateStatus } from '@/server/orders/service';

export interface RefundResult {
  refundId: string;
  amountCents: number;
}

/**
 * Issue a full Stripe refund for an order's outstanding amount.
 *
 * - Calls `stripe.refunds.create({ payment_intent, amount: remaining })`
 *   where `remaining = amountCents - refundedAmountCents`. Errors out if the
 *   order has no captured payment or has already been fully refunded.
 * - Inserts a `RefundEvent` row + bumps `Payment.refundedAmountCents` to the
 *   full captured amount + sets `Payment.status = REFUNDED` in a single tx.
 * - Transitions the Order to RETURNED via `OrderService.updateStatus`
 *   **unless** the order is already terminal (RETURNED / CANCELLED) — guarded
 *   here because both states have no outgoing transitions.
 *
 * Idempotency note: callers (admin endpoints, returns flow) should ensure
 * they don't double-call. The Stripe API itself rejects refunds beyond the
 * captured amount, but a no-op guard is cheaper than a 4xx round-trip.
 */
export async function refundFull(
  orderId: string,
  reason: string,
): Promise<RefundResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: true },
  });
  if (!order) throw new Error(`Order ${orderId} not found`);
  if (!order.payment?.stripePaymentIntentId) {
    throw new Error(`Order ${orderId} has no Stripe payment intent`);
  }
  if (order.payment.status !== 'CAPTURED' &&
      order.payment.status !== 'AUTHORISED') {
    throw new Error(
      `Order ${orderId} payment is ${order.payment.status}, cannot refund`,
    );
  }

  const remaining = order.payment.amountCents - order.payment.refundedAmountCents;
  if (remaining <= 0) {
    throw new Error(`Order ${orderId} is already fully refunded`);
  }

  const refund = await stripe.refunds.create({
    payment_intent: order.payment.stripePaymentIntentId,
    amount: remaining,
    metadata: { orderId, reason },
  });

  await prisma.$transaction([
    prisma.refundEvent.create({
      data: {
        orderId,
        stripeRefundId: refund.id,
        amountCents: remaining,
        reason,
      },
    }),
    prisma.payment.update({
      where: { id: order.payment.id },
      data: {
        refundedAmountCents: order.payment.amountCents,
        status: 'REFUNDED',
      },
    }),
  ]);

  if (order.status !== 'CANCELLED' && order.status !== 'RETURNED') {
    await updateStatus(orderId, 'RETURNED', `refund: ${reason}`);
  }

  return { refundId: refund.id, amountCents: remaining };
}
