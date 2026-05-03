import type { Shipment } from '@prisma/client';
import { prisma } from '../db/client';
import { env } from '../env';
import { getEmailService } from '../email';
import { sendTemplatedEmail } from '../email/send';
import { AdminAlertLabelFailure } from '@/emails/admin-alert-label-failure';
import { AdminAlertTrackingStale } from '@/emails/admin-alert-tracking-stale';

/** No `to:` recipient configured — caller is a no-op. */
function alertRecipient(): string | null {
  return env.ALERT_EMAIL ?? null;
}

/**
 * Notify the operator that a Shipment has exhausted its label-creation
 * retries. Called from {@link tryCreateShipment} (Group H, Task 50) once
 * `attemptCount` hits {@link shouldGiveUp}.
 *
 * Spec §12.
 */
export async function sendLabelFailureAlert(shipment: Shipment): Promise<void> {
  const to = alertRecipient();
  if (!to) return;

  const order = await prisma.order.findUnique({ where: { id: shipment.orderId } });
  if (!order) return;

  await sendTemplatedEmail({
    service: getEmailService(),
    to,
    subject: `[YNOT alert] Label failed for order ${order.orderNumber}`,
    component: (
      <AdminAlertLabelFailure
        orderNumber={order.orderNumber}
        shipmentId={shipment.id}
        errorMessage={shipment.lastAttemptError ?? 'unknown'}
        adminUrl={`${env.NEXT_PUBLIC_SITE_URL}/admin/orders/${order.id}/ship`}
      />
    ),
  });
}

/**
 * Notify the operator that the tracking-sync cron has been failing for an
 * extended window. Called from the Group N `sync-tracking` job once the
 * consecutive-failure threshold is crossed. Spec §12.
 */
export async function sendTrackingStaleAlert(
  affectedCount: number,
  oldestStaleSinceHours: number,
): Promise<void> {
  const to = alertRecipient();
  if (!to) return;

  await sendTemplatedEmail({
    service: getEmailService(),
    to,
    subject: `[YNOT alert] Tracking sync stale (${affectedCount} orders)`,
    component: (
      <AdminAlertTrackingStale
        affectedCount={affectedCount}
        oldestStaleSinceHours={oldestStaleSinceHours}
        adminUrl={`${env.NEXT_PUBLIC_SITE_URL}/admin/orders?filter=needs-tracking-update`}
      />
    ),
  });
}
