import type { OrderItem } from '@prisma/client';

export interface ShipmentGroup {
  carrier: 'ROYAL_MAIL' | 'DHL';
  /** `null` for the in-stock group; set to the PreorderBatch.id otherwise. */
  preorderBatchId: string | null;
  itemIds: string[];
}

/**
 * Decide how to split a freshly created Order's items into Shipment rows.
 *
 * Rules (spec §6.1, §9):
 * - All in-stock items collapse into one shipment that despatches immediately.
 * - Each preorder batch becomes its own shipment that waits for
 *   `releaseBatchForShipping` before label creation.
 * - Carrier follows ship-to country: GB → Royal Mail; everything else → DHL.
 * - Preorder items missing a `preorderBatchId` are skipped — they are
 *   ill-formed and a Phase 5 backfill or admin tool should fix them later.
 *
 * The function is pure: callers persist the resulting groups by inserting
 * Shipment rows and updating `OrderItem.shipmentId`.
 */
export function splitOrderIntoShipments(
  items: Array<Pick<OrderItem, 'id' | 'isPreorder' | 'preorderBatchId'>>,
  countryCode: string,
): ShipmentGroup[] {
  const carrier: ShipmentGroup['carrier'] = countryCode === 'GB' ? 'ROYAL_MAIL' : 'DHL';
  const groups: ShipmentGroup[] = [];

  const inStockIds = items.filter((i) => !i.isPreorder).map((i) => i.id);
  if (inStockIds.length > 0) {
    groups.push({ carrier, preorderBatchId: null, itemIds: inStockIds });
  }

  const preorderByBatch = new Map<string, string[]>();
  for (const item of items) {
    if (!item.isPreorder || !item.preorderBatchId) continue;
    const list = preorderByBatch.get(item.preorderBatchId) ?? [];
    list.push(item.id);
    preorderByBatch.set(item.preorderBatchId, list);
  }
  for (const [batchId, itemIds] of preorderByBatch) {
    groups.push({ carrier, preorderBatchId: batchId, itemIds });
  }

  return groups;
}
