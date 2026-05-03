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

export interface RefundPartialItemInput {
  /** OrderItem.id to refund (must belong to the order). */
  orderItemId: string;
  /** Quantity being refunded — must be ≤ ordered qty. Stock is bumped by this amount. */
  quantity: number;
}

/**
 * Refund a custom set of items on the order.
 *
 * - Sums `unitPriceCents * quantity` per requested item to compute the refund
 *   amount; passes that to Stripe via `refunds.create({ amount })`.
 * - Restocks each refunded item against `ProductSize.stock` (additive).
 * - Inserts a `RefundEvent` row + bumps `Payment.refundedAmountCents`.
 * - Marks Payment.status REFUNDED **only** if the cumulative refunded amount
 *   equals the captured amount; otherwise leaves Payment in CAPTURED so a
 *   future partial / full refund can still proceed.
 * - Does NOT transition Order to RETURNED unless fully refunded — partial
 *   refunds are common in disputes / damaged-in-transit credits and the
 *   Order should stay DELIVERED-ish until the customer's done.
 */
export async function refundPartialItems(
  orderId: string,
  items: RefundPartialItemInput[],
  reason: string,
): Promise<RefundResult> {
  if (items.length === 0) {
    throw new Error('refundPartialItems requires at least one item');
  }
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: true, items: true },
  });
  if (!order) throw new Error(`Order ${orderId} not found`);
  if (!order.payment?.stripePaymentIntentId) {
    throw new Error(`Order ${orderId} has no Stripe payment intent`);
  }
  if (order.payment.status !== 'CAPTURED') {
    throw new Error(
      `Order ${orderId} payment is ${order.payment.status}, cannot refund`,
    );
  }

  let refundAmount = 0;
  for (const it of items) {
    const oi = order.items.find((o) => o.id === it.orderItemId);
    if (!oi) {
      throw new Error(
        `OrderItem ${it.orderItemId} does not belong to order ${orderId}`,
      );
    }
    if (it.quantity < 1 || it.quantity > oi.quantity) {
      throw new Error(
        `Invalid refund quantity ${it.quantity} for ${it.orderItemId} (max ${oi.quantity})`,
      );
    }
    refundAmount += oi.unitPriceCents * it.quantity;
  }

  const remaining = order.payment.amountCents - order.payment.refundedAmountCents;
  if (refundAmount > remaining) {
    throw new Error(
      `Refund amount ${refundAmount} exceeds remaining ${remaining} on order ${orderId}`,
    );
  }

  const refund = await stripe.refunds.create({
    payment_intent: order.payment.stripePaymentIntentId,
    amount: refundAmount,
    metadata: { orderId, reason },
  });

  const newRefundedTotal = order.payment.refundedAmountCents + refundAmount;
  const fullyRefunded = newRefundedTotal >= order.payment.amountCents;

  await prisma.$transaction(async (tx) => {
    await tx.refundEvent.create({
      data: {
        orderId,
        stripeRefundId: refund.id,
        amountCents: refundAmount,
        reason,
      },
    });
    await tx.payment.update({
      where: { id: order.payment!.id },
      data: {
        refundedAmountCents: newRefundedTotal,
        ...(fullyRefunded ? { status: 'REFUNDED' } : {}),
      },
    });
    for (const it of items) {
      const oi = order.items.find((o) => o.id === it.orderItemId)!;
      if (oi.productId) {
        await tx.productSize.update({
          where: { productId_size: { productId: oi.productId, size: oi.size } },
          data: { stock: { increment: it.quantity } },
        });
      }
    }
  });

  if (fullyRefunded &&
      order.status !== 'CANCELLED' &&
      order.status !== 'RETURNED') {
    await updateStatus(orderId, 'RETURNED', `refund: ${reason}`);
  }

  return { refundId: refund.id, amountCents: refundAmount };
}
