import { prisma } from '../db/client';
import type { TrackingProvider } from './provider';

/** Carrier-keyed lookup of tracking provider implementations. */
export interface TrackingProviders {
  dhl: TrackingProvider;
  royalMail: TrackingProvider;
}

export interface SyncShipmentResult {
  /** True when this sync set a previously-null `Shipment.deliveredAt`. */
  statusChanged: boolean;
  /** Number of newly-inserted ShipmentEvent rows. */
  newEvents: number;
}

/**
 * Pull the latest tracking events for a single Shipment from its carrier and
 * write any new ones into ShipmentEvent. Sets `Shipment.deliveredAt` when the
 * carrier reports delivery for the first time.
 *
 * Does NOT transition the parent Order — that reconciliation runs in the
 * Group N `sync-tracking` cron job, which calls this for each pending
 * shipment then walks the affected orders separately. Spec §7.4.
 */
export async function syncShipment(
  shipmentId: string,
  providers: TrackingProviders,
): Promise<SyncShipmentResult> {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment || !shipment.trackingNumber || shipment.deliveredAt) {
    return { statusChanged: false, newEvents: 0 };
  }

  const provider = shipment.carrier === 'DHL' ? providers.dhl : providers.royalMail;
  const result = await provider.getStatus(shipment.trackingNumber);

  // Insert new events, deduped on (shipmentId, occurredAt, rawCarrierStatus).
  // We compare on `rawCarrierStatus` because that is the value persisted on
  // ShipmentEvent.status — the normalised enum is computed at read time.
  let newEvents = 0;
  for (const event of result.events) {
    const exists = await prisma.shipmentEvent.findFirst({
      where: {
        shipmentId,
        occurredAt: event.occurredAt,
        status: event.rawCarrierStatus,
      },
    });
    if (exists) continue;
    await prisma.shipmentEvent.create({
      data: {
        shipmentId,
        status: event.rawCarrierStatus,
        description: event.description,
        occurredAt: event.occurredAt,
      },
    });
    newEvents += 1;
  }

  let statusChanged = false;
  if (result.deliveredAt && !shipment.deliveredAt) {
    await prisma.shipment.update({
      where: { id: shipmentId },
      data: { deliveredAt: result.deliveredAt },
    });
    statusChanged = true;
  }

  return { statusChanged, newEvents };
}
