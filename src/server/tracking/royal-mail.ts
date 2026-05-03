import type {
  TrackingEvent,
  TrackingProvider,
  TrackingResult,
  TrackingStatus,
} from './provider';

const RM_BASE = 'https://api.parcel.royalmail.com/api/v1';

/**
 * Royal Mail at the OLP (Online Postage) tier does not expose a separate
 * tracking API — order lifecycle is read back via the same Click & Drop
 * endpoint used to create the shipment. We synthesize {@link TrackingEvent}s
 * from the timestamp fields the order resource exposes.
 *
 * Spec §7.4 (tracking sync); plan task 46 documents the Shipment.trackingNumber
 * → orders?trackingNumber=... lookup workaround (RM order id is not stored on
 * Shipment).
 */
const STATUS_MAP: Record<string, TrackingStatus> = {
  new: 'UNKNOWN',
  pending: 'UNKNOWN',
  despatched: 'IN_TRANSIT',
  dispatched: 'IN_TRANSIT', // tolerate spelling drift
  outfordelivery: 'OUT_FOR_DELIVERY',
  'out for delivery': 'OUT_FOR_DELIVERY',
  delivered: 'DELIVERED',
  cancelled: 'EXCEPTION',
  failed: 'EXCEPTION',
};

interface RmOrderResource {
  orderIdentifier?: number | string;
  trackingNumber?: string;
  orderStatus?: string;
  despatchedDate?: string;
  deliveredDate?: string;
}

interface RmOrdersResponse {
  orders?: RmOrderResource[];
}

export interface RoyalMailTrackingConfig {
  apiKey: string;
  fetcher?: typeof fetch;
}

function mapStatus(code: string | undefined): TrackingStatus {
  if (!code) return 'UNKNOWN';
  return STATUS_MAP[code.toLowerCase()] ?? 'UNKNOWN';
}

/**
 * Royal Mail tracking via Click & Drop.
 *
 * Click & Drop's `GET /orders` endpoint accepts a `trackingNumber` filter,
 * which lets us look up status without persisting the rmOrderId on Shipment.
 * If the API rejects the filter we fall back to UNKNOWN — a future schema
 * change can store rmOrderId for direct `/orders/:id` lookups.
 */
export class RoyalMailTrackingProvider implements TrackingProvider {
  private readonly fetcher: typeof fetch;

  constructor(private readonly cfg: RoyalMailTrackingConfig) {
    this.fetcher = cfg.fetcher ?? fetch;
  }

  async getStatus(trackingNumber: string): Promise<TrackingResult> {
    const url = `${RM_BASE}/orders?trackingNumber=${encodeURIComponent(trackingNumber)}`;
    const resp = await this.fetcher(url, {
      headers: {
        Authorization: `Bearer ${this.cfg.apiKey}`,
        Accept: 'application/json',
      },
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Royal Mail Tracking ${resp.status}: ${err}`);
    }
    const data = (await resp.json()) as RmOrdersResponse;
    const order = data.orders?.[0];
    if (!order) {
      return { currentStatus: 'UNKNOWN', events: [], deliveredAt: null };
    }

    // Synthesize events from the timestamp fields the resource exposes.
    const events: TrackingEvent[] = [];
    if (order.despatchedDate) {
      events.push({
        status: 'IN_TRANSIT',
        rawCarrierStatus: 'despatched',
        description: 'Despatched by sender',
        occurredAt: new Date(order.despatchedDate),
      });
    }
    if (order.deliveredDate) {
      events.push({
        status: 'DELIVERED',
        rawCarrierStatus: 'delivered',
        description: 'Delivered to recipient',
        occurredAt: new Date(order.deliveredDate),
      });
    }

    const currentStatus = mapStatus(order.orderStatus);
    const deliveredEvent = events.find((e) => e.status === 'DELIVERED');
    return {
      currentStatus,
      events,
      deliveredAt: deliveredEvent?.occurredAt ?? null,
    };
  }
}
