import * as React from 'react';
import type Redis from 'ioredis';
import type { OrderStatus } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { env } from '@/server/env';
import { redis as defaultRedis } from '@/server/redis';
import { syncShipment, type TrackingProviders } from '@/server/tracking/service';
import { updateStatus } from '@/server/orders/service';
import { sendTrackingStaleAlert as defaultSendTrackingStaleAlert } from '@/server/alerts/service';
import { getEmailService, type EmailService } from '@/server/email';
import { sendTemplatedEmail } from '@/server/email/send';
import { OrderDelivered } from '@/emails/order-delivered';

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
  /** Override the email transport for OrderDelivered (defaults to `getEmailService()`). */
  emailService?: EmailService;
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

  // Snapshot the IDs of shipments that were undelivered when this tick
  // started — `syncShipment` may have set `deliveredAt` on a subset, and we
  // want to fire `OrderDelivered` exactly once per such transition.
  const candidateShipmentIds = shipments.map((s) => s.id);
  await reconcileOrderStatuses();
  await sendOrderDeliveredEmails(
    candidateShipmentIds,
    deps.emailService ?? getEmailService(),
  );

  return { synced, failed };
}

/**
 * Send `OrderDelivered` once per shipment that flipped from undelivered →
 * delivered during this sync tick. Idempotent because we only consider the
 * shipment IDs that started the tick still undelivered — a re-run after the
 * carrier reports the same state finds no candidates.
 *
 * Failures are best-effort: a single template render or transport error is
 * logged but never aborts the cron loop.
 */
async function sendOrderDeliveredEmails(
  candidateShipmentIds: string[],
  emailService: EmailService,
): Promise<void> {
  if (candidateShipmentIds.length === 0) return;

  const newlyDelivered = await prisma.shipment.findMany({
    where: {
      id: { in: candidateShipmentIds },
      deliveredAt: { not: null },
      cancelledAt: null,
    },
    include: { order: { include: { user: true } } },
  });

  for (const ship of newlyDelivered) {
    const recipient = ship.order.user?.email ?? null;
    if (!recipient) continue;
    try {
      await sendTemplatedEmail({
        service: emailService,
        to: recipient,
        subject: `Your order ${ship.order.orderNumber} has arrived`,
        component: React.createElement(OrderDelivered, {
          orderNumber: ship.order.orderNumber,
          customerName: ship.order.shipFirstName,
          reviewUrl: `${env.NEXT_PUBLIC_SITE_URL}/account/orders/${ship.order.id}`,
        }),
      });
    } catch (err) {
      process.stderr.write(
        `[worker] OrderDelivered email failed for shipment ${ship.id}: ${
          err instanceof Error ? err.message : String(err)
        }\n`,
      );
    }
  }
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
