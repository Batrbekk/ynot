import type { Shipment } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { nextRetryDelayMs } from '@/server/fulfilment/retry';
import {
  tryCreateShipment as defaultTryCreateShipment,
  type TryCreateShipmentDeps,
  type TryCreateShipmentResult,
} from '@/server/fulfilment/service';

export interface RetryFailedShipmentsDeps extends TryCreateShipmentDeps {
  /**
   * Override the per-shipment retry call. Defaults to the production
   * `tryCreateShipment` which itself increments `attemptCount` + alerts on
   * give-up. Tests inject a spy.
   */
  tryCreateShipment?: (
    shipmentId: string,
    deps: TryCreateShipmentDeps,
  ) => Promise<TryCreateShipmentResult>;
}

export interface RetryFailedShipmentsResult {
  retried: number;
  skipped: number;
}

/**
 * 5-minute worker job: re-attempts label creation for any Shipment whose
 * carrier call previously failed.
 *
 * Selection: `labelGeneratedAt = null AND cancelledAt = null AND
 * attemptCount BETWEEN 1 AND 5`. The lower bound excludes brand-new rows
 * (the synchronous webhook attempt has not yet bumped the counter); the
 * upper bound excludes give-up rows (those got their alert via
 * {@link tryCreateShipment} already).
 *
 * Honour the backoff schedule: only retry if the row has been idle for
 * `nextRetryDelayMs(attemptCount)` ms.
 */
export async function retryFailedShipments(
  deps: RetryFailedShipmentsDeps,
): Promise<RetryFailedShipmentsResult> {
  const tryCreate = deps.tryCreateShipment ?? defaultTryCreateShipment;

  const candidates: Shipment[] = await prisma.shipment.findMany({
    where: {
      labelGeneratedAt: null,
      cancelledAt: null,
      attemptCount: { gte: 1, lte: 5 },
    },
  });

  let retried = 0;
  let skipped = 0;
  for (const s of candidates) {
    const delay = nextRetryDelayMs(s.attemptCount);
    if (delay === null) {
      skipped += 1;
      continue;
    }
    if (Date.now() - s.updatedAt.getTime() < delay) {
      skipped += 1;
      continue;
    }
    await tryCreate(s.id, deps);
    retried += 1;
  }

  return { retried, skipped };
}
