import { describe, expect, it } from 'vitest';
import type {
  TrackingEvent,
  TrackingProvider,
  TrackingResult,
  TrackingStatus,
} from '../provider';

describe('TrackingProvider types', () => {
  it('TrackingStatus enum supports the five canonical values', () => {
    const statuses: TrackingStatus[] = [
      'IN_TRANSIT',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'EXCEPTION',
      'UNKNOWN',
    ];
    // Compile-time check: assignability is the assertion. Runtime sanity:
    expect(new Set(statuses).size).toBe(5);
  });

  it('TrackingEvent and TrackingResult are structurally usable', () => {
    const event: TrackingEvent = {
      status: 'IN_TRANSIT',
      rawCarrierStatus: 'transit',
      description: 'In transit to local depot',
      occurredAt: new Date('2026-05-01T10:00:00Z'),
    };
    const result: TrackingResult = {
      currentStatus: 'IN_TRANSIT',
      events: [event],
      deliveredAt: null,
    };
    expect(result.events[0].status).toBe('IN_TRANSIT');
    expect(result.deliveredAt).toBeNull();
  });

  it('TrackingProvider implementations expose getStatus', async () => {
    const provider: TrackingProvider = {
      async getStatus(_trackingNumber: string): Promise<TrackingResult> {
        return { currentStatus: 'UNKNOWN', events: [], deliveredAt: null };
      },
    };
    const r = await provider.getStatus('AB123');
    expect(r.currentStatus).toBe('UNKNOWN');
    expect(r.events).toEqual([]);
  });
});
