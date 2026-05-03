import { prisma } from '@/server/db/client';

/**
 * Find the active {@link PreorderBatch} a preorder line should join.
 *
 * Eligibility (spec §9.2):
 * - `productId` matches the cart/order item
 * - `status` ∈ { `PENDING`, `IN_PRODUCTION` } — `SHIPPING` and `COMPLETED`
 *   are closed for new assignments
 * - earliest `estimatedShipFrom` wins (so the customer gets the soonest
 *   despatch slot)
 *
 * Returns `null` when no active batch exists for the product. Callers (cart
 * `addItem` + checkout `createOrderAndPaymentIntent`) treat `null` as
 * "either don't allow preorder for this product, or hold the item with a
 * dangling `preorderBatchId = null`" — that decision is upstream.
 */
export async function assignItemToBatch(
  productId: string,
): Promise<string | null> {
  const batch = await prisma.preorderBatch.findFirst({
    where: {
      productId,
      status: { in: ['PENDING', 'IN_PRODUCTION'] },
    },
    orderBy: { estimatedShipFrom: 'asc' },
    select: { id: true },
  });
  return batch?.id ?? null;
}
