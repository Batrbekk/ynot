import { describe, expect, it, vi } from 'vitest';
import { RoyalMailTrackingProvider } from '../royal-mail';

describe('RoyalMailTrackingProvider.getStatus', () => {
  it('queries Click & Drop /orders by trackingNumber with Bearer auth and maps despatched -> IN_TRANSIT', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        orders: [
          {
            orderIdentifier: 90001,
            trackingNumber: 'RM12345678GB',
            orderStatus: 'despatched',
            despatchedDate: '2026-04-30T11:00:00Z',
          },
        ],
      }),
      text: async () => '',
    });
    const p = new RoyalMailTrackingProvider({
      apiKey: 'rm-key',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    const r = await p.getStatus('RM12345678GB');

    expect(r.currentStatus).toBe('IN_TRANSIT');
    expect(r.deliveredAt).toBeNull();
    expect(r.events).toHaveLength(1);
    expect(r.events[0].status).toBe('IN_TRANSIT');
    expect(r.events[0].rawCarrierStatus).toBe('despatched');
    expect(r.events[0].occurredAt.toISOString()).toBe('2026-04-30T11:00:00.000Z');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.parcel.royalmail.com/api/v1/orders?trackingNumber=RM12345678GB');
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer rm-key');
    expect(headers.Accept).toBe('application/json');
  });

  it('maps "delivered" to DELIVERED and uses despatchedDate as deliveredAt fallback when deliveredDate present', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        orders: [
          {
            orderIdentifier: 90002,
            trackingNumber: 'RM99GB',
            orderStatus: 'delivered',
            despatchedDate: '2026-04-30T11:00:00Z',
            deliveredDate: '2026-05-01T10:15:00Z',
          },
        ],
      }),
      text: async () => '',
    });
    const p = new RoyalMailTrackingProvider({
      apiKey: 'k',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    const r = await p.getStatus('RM99GB');
    expect(r.currentStatus).toBe('DELIVERED');
    expect(r.deliveredAt?.toISOString()).toBe('2026-05-01T10:15:00.000Z');
    // Despatched event + delivered event
    expect(r.events).toHaveLength(2);
    expect(r.events.map((e) => e.status)).toEqual(['IN_TRANSIT', 'DELIVERED']);
  });

  it('returns UNKNOWN when no orders match the trackingNumber', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ orders: [] }),
      text: async () => '',
    });
    const p = new RoyalMailTrackingProvider({
      apiKey: 'k',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    const r = await p.getStatus('NOTFOUND');
    expect(r.currentStatus).toBe('UNKNOWN');
    expect(r.events).toEqual([]);
    expect(r.deliveredAt).toBeNull();
  });

  it('throws on non-2xx response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => 'bad gateway',
    });
    const p = new RoyalMailTrackingProvider({
      apiKey: 'k',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    await expect(p.getStatus('TRK')).rejects.toThrow(/Royal Mail.*502/);
  });
});
