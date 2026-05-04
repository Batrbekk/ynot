import type { OrderStatus } from '@prisma/client';

/**
 * Allowed Order status transitions per spec §7.1.
 *
 * Forward-only. Self-transitions (e.g. PROCESSING → PROCESSING) are silently
 * permitted by {@link assertTransition} so callers can no-op when an upstream
 * event arrives twice.
 *
 * Terminal states (`RETURNED`, `CANCELLED`) have no outgoing edges.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['NEW', 'PAYMENT_FAILED', 'CANCELLED'],
  PAYMENT_FAILED: ['PENDING_PAYMENT', 'CANCELLED'],
  NEW: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'PARTIALLY_SHIPPED', 'CANCELLED'],
  PARTIALLY_SHIPPED: ['SHIPPED', 'PARTIALLY_DELIVERED', 'DELIVERED'],
  SHIPPED: ['DELIVERED', 'PARTIALLY_DELIVERED', 'RETURNED'],
  PARTIALLY_DELIVERED: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  RETURNED: [],
  CANCELLED: [],
};

export class IllegalTransitionError extends Error {
  readonly from: OrderStatus;
  readonly to: OrderStatus;
  constructor(from: OrderStatus, to: OrderStatus) {
    super(`Illegal Order status transition: ${from} → ${to}`);
    this.name = 'IllegalTransitionError';
    this.from = from;
    this.to = to;
  }
}

/**
 * Throws {@link IllegalTransitionError} if `to` is not reachable from `from`.
 * Same-state transitions (`from === to`) are a no-op.
 */
export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (from === to) return;
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new IllegalTransitionError(from, to);
  }
}
