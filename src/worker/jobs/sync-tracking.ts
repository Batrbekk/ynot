import type Redis from 'ioredis';
import type { OrderStatus } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { redis as defaultRedis } from '@/server/redis';
import { syncShipment, type TrackingProviders } from '@/server/tracking/service';
import { updateStatus } from '@/server/orders/service';
import { sendTrackingStaleAlert as defaultSendTrackingStaleAlert } from '@/server/alerts/service';

/** Redis key for the consecutive-total-failure counter (spec §12). */
export const TRACKING_FAILURE_COUNTER_KEY = 'tracking_sync_failures';

/** Threshold beyond which the operator gets a one-shot stale-tracking alert. */
export const TRACKING_FAILURE_THRESHOLD = 5;

/** Cap on the number of shipments synced per cron tick. */
const SYNC_BATCH_SIZE = 200;

/**
 * Subset of the ioredis surface this job actually uses — keeps tests free of
 * the full client.
 */
export interface RedisLike {
  incr(key: string): Promise<number>;
  del(key: string): Promise<number>;
}

export interface SyncTrackingDeps {
  providers: TrackingProviders;
  redis?: RedisLike;
  /** Override the operator alert (defaults to the production AlertService). */
  sendTrackingStaleAlert?: (
    affectedCount: number,
    oldestStaleSinceHours: number,
  ) => Promise<void>;
}

export interface SyncTrackingResult {
  synced: number;
  failed: number;
}

/**
 * Hourly tracking sync.
 *
 * 1. Pulls every undelivered, non-cancelled Shipment with a tracking number
 *    (capped at {@link SYNC_BATCH_SIZE}).
 * 2. Calls {@link syncShipment} for each — failures are captured but never
 *    abort the loop.
 * 3. If the entire batch failed, increments a Redis counter; once it crosses
 *    {@link TRACKING_FAILURE_THRESHOLD} the operator gets one alert and the
 *    counter resets. Any partial success resets immediately.
 * 4. Reconciles Order status: orders in `SHIPPED` / `PARTIALLY_SHIPPED` /
 *    `PARTIALLY_DELIVERED` whose remaining shipments are all delivered move
 *    to `DELIVERED`; partial delivery moves to `PARTIALLY_DELIVERED`.
 *
 * Returns counts so the cron loop can log them.
 */
export async function syncTracking(
  deps: SyncTrackingDeps,
): Promise<SyncTrackingResult> {
  const redisClient: RedisLike =
    deps.redis ?? (defaultRedis as unknown as RedisLike);
  const alert = deps.sendTrackingStaleAlert ?? defaultSendTrackingStaleAlert;

  const shipments = await prisma.shipment.findMany({
    where: {
      trackingNumber: { not: null },
      deliveredAt: null,
      cancelledAt: null,
    },
    take: SYNC_BATCH_SIZE,
  });

  let synced = 0;
  let failed = 0;
  for (const s of shipments) {
    try {
      await syncShipment(s.id, deps.providers);
      synced += 1;
    } catch (err) {
      failed += 1;
      process.stderr.write(
        `[worker] syncShipment failed for ${s.id}: ${
          err instanceof Error ? err.message : String(err)
        }\n`,
      );
    }
  }

  if (shipments.length > 0 && failed === shipments.length) {
    const c = await redisClient.incr(TRACKING_FAILURE_COUNTER_KEY);
    if (c >= TRACKING_FAILURE_THRESHOLD) {
      try {
        await alert(shipments.length, TRACKING_FAILURE_THRESHOLD);
      } catch (err) {
        process.stderr.write(
          `[worker] sendTrackingStaleAlert failed: ${
            err instanceof Error ? err.message : String(err)
          }\n`,
        );
      }
      await redisClient.del(TRACKING_FAILURE_COUNTER_KEY);
    }
  } else {
    // Any success (or empty batch) resets the streak.
    await redisClient.del(TRACKING_FAILURE_COUNTER_KEY);
  }

  await reconcileOrderStatuses();

  return { synced, failed };
}

/** Drives Order status forward off the per-shipment delivery state. */
async function reconcileOrderStatuses(): Promise<void> {
  const candidates: OrderStatus[] = [
    'SHIPPED',
    'PARTIALLY_SHIPPED',
    'PARTIALLY_DELIVERED',
  ];
  const orders = await prisma.order.findMany({
    where: { status: { in: candidates } },
    include: { shipments: true },
  });

  for (const order of orders) {
    const active = order.shipments.filter((s) => !s.cancelledAt);
    if (active.length === 0) continue;
    const delivered = active.filter((s) => s.deliveredAt !== null);

    if (delivered.length === active.length) {
      if (order.status !== 'DELIVERED') {
        await updateStatus(order.id, 'DELIVERED', 'tracking-sync: all shipments delivered');
      }
    } else if (delivered.length > 0) {
      if (order.status !== 'PARTIALLY_DELIVERED') {
        await updateStatus(
          order.id,
          'PARTIALLY_DELIVERED',
          'tracking-sync: partial delivery',
        );
      }
    }
  }
}

// Tests reach into ioredis through a structural alias to avoid pulling the SDK.
export type { Redis };
