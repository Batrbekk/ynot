import type {
  TrackingEvent,
  TrackingProvider,
  TrackingResult,
  TrackingStatus,
} from './provider';

const DHL_TRACK_BASE = 'https://api-eu.dhl.com/track/shipments';

/**
 * Map DHL Tracking API `statusCode` strings to our normalised lifecycle.
 * Source: https://developer.dhl.com/api-reference/shipment-tracking
 *
 * Anything not in the table maps to `UNKNOWN`; the original carrier text is
 * still preserved on `TrackingEvent.rawCarrierStatus` for audit.
 */
const STATUS_MAP: Record<string, TrackingStatus> = {
  'pre-transit': 'IN_TRANSIT',
  pretransit: 'IN_TRANSIT',
  transit: 'IN_TRANSIT',
  'in transit': 'IN_TRANSIT',
  'out for delivery': 'OUT_FOR_DELIVERY',
  delivered: 'DELIVERED',
  failure: 'EXCEPTION',
  exception: 'EXCEPTION',
  unknown: 'UNKNOWN',
};

interface DhlTrackEvent {
  statusCode?: string;
  status?: string;
  description?: string;
  timestamp?: string;
}

interface DhlTrackShipment {
  id?: string;
  status?: { statusCode?: string; status?: string };
  events?: DhlTrackEvent[];
}

interface DhlTrackResponse {
  shipments?: DhlTrackShipment[];
}

export interface DhlTrackingConfig {
  /** Tracking API key — distinct from the MyDHL Express OAuth secret. */
  apiKey: string;
  fetcher?: typeof fetch;
}

/** Map a raw carrier statusCode to our enum, defaulting to UNKNOWN. */
function mapStatus(code: string | undefined): TrackingStatus {
  if (!code) return 'UNKNOWN';
  return STATUS_MAP[code.toLowerCase()] ?? 'UNKNOWN';
}

/**
 * DHL Tracking API client.
 *
 * Authentication is `DHL-API-Key` header (NOT the HTTP Basic auth used by
 * MyDHL Express for label generation — these are two distinct API products).
 * Spec §7.4.
 */
export class DhlTrackingProvider implements TrackingProvider {
  private readonly fetcher: typeof fetch;

  constructor(private readonly cfg: DhlTrackingConfig) {
    this.fetcher = cfg.fetcher ?? fetch;
  }

  async getStatus(trackingNumber: string): Promise<TrackingResult> {
    const url = `${DHL_TRACK_BASE}?trackingNumber=${encodeURIComponent(trackingNumber)}`;
    const resp = await this.fetcher(url, {
      headers: {
        'DHL-API-Key': this.cfg.apiKey,
        Accept: 'application/json',
      },
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`DHL Tracking API ${resp.status}: ${err}`);
    }
    const data = (await resp.json()) as DhlTrackResponse;
    const ship = data.shipments?.[0];
    if (!ship) {
      return { currentStatus: 'UNKNOWN', events: [], deliveredAt: null };
    }

    const events: TrackingEvent[] = (ship.events ?? []).map((e) => ({
      status: mapStatus(e.statusCode),
      rawCarrierStatus: e.status ?? e.statusCode ?? '',
      description: e.description ?? e.status ?? '',
      occurredAt: new Date(e.timestamp ?? Date.now()),
    }));

    const currentStatus = mapStatus(ship.status?.statusCode);
    const deliveredEvent = events.find((e) => e.status === 'DELIVERED');
    return {
      currentStatus,
      events,
      deliveredAt: deliveredEvent?.occurredAt ?? null,
    };
  }
}
