/**
 * @fileoverview Tracking provider abstractions for Phase 5.
 *
 * Carrier APIs return wildly different status vocabularies; the worker only
 * cares about a normalised five-value enum. Each carrier-specific provider
 * (DHL, Royal Mail) maps its raw status strings to {@link TrackingStatus} and
 * surfaces both the normalised value plus the original `rawCarrierStatus`
 * (preserved on `ShipmentEvent.status` for audit / debugging).
 *
 * Spec §7.4 (tracking sync), §12 (failure handling).
 */

/** Canonical tracking lifecycle states the worker reasons about. */
export type TrackingStatus =
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'EXCEPTION'
  | 'UNKNOWN';

/** A single scan / status update from the carrier. */
export interface TrackingEvent {
  /** Normalised lifecycle bucket. */
  status: TrackingStatus;
  /** Original carrier vocabulary (e.g. "transit", "despatched") — stored on ShipmentEvent. */
  rawCarrierStatus: string;
  /** Human-readable description (e.g. "Arrived at local depot"). */
  description: string;
  /** When the carrier recorded this event (UTC). */
  occurredAt: Date;
}

/** Aggregate result of a `getStatus` lookup against a carrier. */
export interface TrackingResult {
  /** Latest known lifecycle bucket. */
  currentStatus: TrackingStatus;
  /** Full event history (newest may be first or last; callers must not assume). */
  events: TrackingEvent[];
  /** Set when the carrier reports a successful delivery; `null` otherwise. */
  deliveredAt: Date | null;
}

/** Carrier-specific tracking client. */
export interface TrackingProvider {
  getStatus(trackingNumber: string): Promise<TrackingResult>;
}
