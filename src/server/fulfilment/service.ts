import type { Shipment } from '@prisma/client';
import { prisma } from '../db/client';
import { createShipmentForOrder, type CarrierServiceDeps } from './carrier';
import { shouldGiveUp } from './retry';

export interface TryCreateShipmentDeps extends CarrierServiceDeps {
  /**
   * Operator alert — invoked once when {@link shouldGiveUp} flips true (i.e.
   * after the fifth failed attempt). Injected so tests can spy without
   * exercising the email transport. Production wires this up to
   * `sendLabelFailureAlert` from `@/server/alerts/service`.
   */
  sendLabelFailureAlert: (shipment: Shipment) => Promise<void>;
}

export interface TryCreateShipmentResult {
  ok: boolean;
  /** True iff this attempt pushed `attemptCount` past the retry schedule. */
  gaveUp?: boolean;
  /** Carrier error message, when the attempt failed. */
  error?: string;
}

/**
 * Wrap {@link createShipmentForOrder} with retry counter + give-up alert.
 *
 * - Success: `{ ok: true }`. Counter is *not* reset — once the label is
 *   generated the row is no longer eligible for retry (the cron filter checks
 *   `labelGeneratedAt IS NULL`).
 * - Failure: `attemptCount++`, `lastAttemptError` stored, `{ ok: false, error }`.
 * - Failure on attempt that pushes counter to the schedule length: same as
 *   above plus `sendLabelFailureAlert` and `gaveUp: true`.
 *
 * Alert delivery errors are swallowed (logged to stderr) so a flaky email
 * provider can never mask the underlying carrier failure result.
 *
 * Spec §12 (failure handling matrix).
 */
export async function tryCreateShipment(
  shipmentId: string,
  deps: TryCreateShipmentDeps,
): Promise<TryCreateShipmentResult> {
  try {
    await createShipmentForOrder(shipmentId, deps);
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    const updated = await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        attemptCount: { increment: 1 },
        lastAttemptError: error,
      },
    });
    if (shouldGiveUp(updated.attemptCount)) {
      try {
        await deps.sendLabelFailureAlert(updated);
      } catch (alertErr) {
        // Don't let a flaky alert pipeline mask the carrier error.
        process.stderr.write(
          `[fulfilment] sendLabelFailureAlert failed for ${shipmentId}: ${
            alertErr instanceof Error ? alertErr.message : String(alertErr)
          }\n`,
        );
      }
      return { ok: false, gaveUp: true, error };
    }
    return { ok: false, error };
  }
}
