import { describe, expect, it, vi } from 'vitest';
import { DhlTrackingProvider } from '../dhl';

describe('DhlTrackingProvider.getStatus', () => {
  it('calls the DHL Tracking API with the DHL-API-Key header and trackingNumber query', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        shipments: [
          {
            id: '1234567890',
            status: { statusCode: 'transit', status: 'In transit', timestamp: '2026-04-30T12:00:00Z' },
            events: [
              {
                statusCode: 'pre-transit',
                status: 'Shipment information received',
                description: 'Shipment information received',
                timestamp: '2026-04-30T08:00:00Z',
              },
              {
                statusCode: 'transit',
                status: 'In transit',
                description: 'Processed at facility',
                timestamp: '2026-04-30T12:00:00Z',
              },
            ],
          },
        ],
      }),
      text: async () => '',
    });

    const p = new DhlTrackingProvider({
      apiKey: 'tk-key',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    const r = await p.getStatus('1234567890');

    expect(r.currentStatus).toBe('IN_TRANSIT');
    expect(r.deliveredAt).toBeNull();
    expect(r.events).toHaveLength(2);
    expect(r.events[0].status).toBe('IN_TRANSIT');
    expect(r.events[0].rawCarrierStatus).toBe('Shipment information received');
    expect(r.events[1].occurredAt.toISOString()).toBe('2026-04-30T12:00:00.000Z');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api-eu.dhl.com/track/shipments?trackingNumber=1234567890');
    const headers = init?.headers as Record<string, string>;
    expect(headers['DHL-API-Key']).toBe('tk-key');
    expect(headers.Accept).toBe('application/json');
  });

  it('maps "delivered" to DELIVERED and surfaces deliveredAt from the matching event', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        shipments: [
          {
            status: { statusCode: 'delivered' },
            events: [
              {
                statusCode: 'transit',
                status: 'In transit',
                description: 'In transit',
                timestamp: '2026-04-30T12:00:00Z',
              },
              {
                statusCode: 'delivered',
                status: 'Delivered',
                description: 'Delivered to recipient',
                timestamp: '2026-05-01T09:30:00Z',
              },
            ],
          },
        ],
      }),
      text: async () => '',
    });
    const p = new DhlTrackingProvider({
      apiKey: 'k',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    const r = await p.getStatus('TRK1');
    expect(r.currentStatus).toBe('DELIVERED');
    expect(r.deliveredAt?.toISOString()).toBe('2026-05-01T09:30:00.000Z');
  });

  it('maps "out for delivery" status code to OUT_FOR_DELIVERY', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        shipments: [
          {
            status: { statusCode: 'out for delivery' },
            events: [
              {
                statusCode: 'out for delivery',
                status: 'Out for delivery',
                description: 'On the truck',
                timestamp: '2026-05-01T07:00:00Z',
              },
            ],
          },
        ],
      }),
      text: async () => '',
    });
    const p = new DhlTrackingProvider({
      apiKey: 'k',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    const r = await p.getStatus('TRK1');
    expect(r.currentStatus).toBe('OUT_FOR_DELIVERY');
    expect(r.events[0].status).toBe('OUT_FOR_DELIVERY');
  });

  it('returns UNKNOWN when shipments array is empty', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ shipments: [] }),
      text: async () => '',
    });
    const p = new DhlTrackingProvider({
      apiKey: 'k',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    const r = await p.getStatus('NX');
    expect(r.currentStatus).toBe('UNKNOWN');
    expect(r.events).toEqual([]);
    expect(r.deliveredAt).toBeNull();
  });

  it('throws on non-2xx response with the status code surfaced', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'service unavailable',
    });
    const p = new DhlTrackingProvider({
      apiKey: 'k',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    await expect(p.getStatus('TRK')).rejects.toThrow(/DHL.*503/);
  });
});
