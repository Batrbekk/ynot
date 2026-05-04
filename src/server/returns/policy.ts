import type { Order, Shipment } from '@prisma/client';

/** Returns are accepted for 14 calendar days from the latest delivery. */
export const RETURN_WINDOW_DAYS = 14;

const WINDOW_MS = RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/**
 * True iff the order has at least one delivered Shipment whose `deliveredAt`
 * falls within the {@link RETURN_WINDOW_DAYS}-day window relative to `now`.
 *
 * Mixed-shipment orders use the **latest** delivery — earlier deliveries do
 * not extend the window beyond the most recent one. Orders with no delivered
 * shipments fall through to `false` (you cannot return what hasn't arrived).
 *
 * Spec §8.5 (return window).
 */
export function isWithinReturnWindow(
  order: { shipments: Pick<Shipment, 'deliveredAt'>[] },
  now: Date = new Date(),
): boolean {
  const latest = order.shipments.reduce<Date | null>(
    (acc, s) =>
      s.deliveredAt && (!acc || s.deliveredAt > acc) ? s.deliveredAt : acc,
    null,
  );
  if (!latest) return false;
  return now.getTime() - latest.getTime() <= WINDOW_MS;
}

export type ReturnLabelPolicy = 'PREPAID_UK' | 'CUSTOMER_ARRANGED';

/**
 * Per spec §8.4: UK customers receive a prepaid Royal Mail Tracked Returns
 * label paid for by YNOT; everyone else arranges their own return shipment
 * (and gets a customs declaration PDF instead).
 */
export function returnLabelPolicy(
  order: Pick<Order, 'shipCountry'>,
): ReturnLabelPolicy {
  return order.shipCountry === 'GB' ? 'PREPAID_UK' : 'CUSTOMER_ARRANGED';
}
