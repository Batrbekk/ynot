import { describe, expect, it, vi } from 'vitest';
import { RoyalMailClickDropProvider } from '../royal-mail-click-drop';
import type { CreateShipmentInput } from '../provider';

const baseInput: CreateShipmentInput = {
  orderRef: 'YN-2026-00099',
  recipient: {
    fullName: 'James Smith',
    addressLine1: '221B Baker Street',
    city: 'London',
    postalCode: 'NW1 6XE',
    countryCode: 'GB',
    email: 'james@example.com',
    phone: '+44 7000 111222',
  },
  items: [
    {
      productSlug: 'oxford-shirt',
      name: 'Oxford Shirt — White',
      sku: 'SHRT-OX-WHT-M',
      quantity: 2,
      unitPriceCents: 9500,
      weightGrams: 250,
      hsCode: null,
      countryOfOriginCode: 'GB',
    },
  ],
  weightGrams: 500,
  subtotalCents: 19000,
  declaredValueCents: 19000,
  isInternational: false,
};

describe('RoyalMailClickDropProvider.createShipment', () => {
  it('posts to /orders with bearer auth and TPN service code', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        createdOrders: [
          {
            orderIdentifier: 12345,
            orderReference: 'YN-2026-00099',
            trackingNumber: 'AB123456789GB',
          },
        ],
        errorsCount: 0,
        successCount: 1,
      }),
      text: async () => '',
    });
    const p = new RoyalMailClickDropProvider({
      apiKey: 'rm-key-xyz',
      fetcher: fetchMock as unknown as typeof fetch,
    });

    const r = await p.createShipment(baseInput);
    expect(r.trackingNumber).toBe('AB123456789GB');
    expect(r.rmOrderId).toBe('12345');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.parcel.royalmail.com/api/v1/orders');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer rm-key-xyz');
    expect(headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body as string);
    expect(body.items).toHaveLength(1);
    const order = body.items[0];
    expect(order.orderReference).toBe('YN-2026-00099');
    expect(order.recipient.address.postcode).toBe('NW1 6XE');
    expect(order.recipient.address.countryCode).toBe('GB');
    expect(order.recipient.address.fullName).toBe('James Smith');
    expect(order.packages[0].weightInGrams).toBe(500);
    expect(order.packages[0].packageFormatIdentifier).toBe('smallParcel');
    expect(order.subtotal).toBe(190);
    expect(order.total).toBe(190);
    expect(order.shippingCostCharged).toBe(0);
    expect(order.currencyCode).toBe('GBP');
    expect(order.postageDetails.serviceCode).toBe('TPN');
    expect(order.orderLines[0].SKU).toBe('SHRT-OX-WHT-M');
    expect(order.orderLines[0].quantity).toBe(2);
    expect(order.orderLines[0].unitValue).toBe(95);
    expect(order.orderLines[0].unitWeightInGrams).toBe(250);
  });

  it('throws on non-2xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'unauthorised',
    });
    const p = new RoyalMailClickDropProvider({
      apiKey: 'bad',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    await expect(p.createShipment(baseInput)).rejects.toThrow(/Royal Mail.*createShipment.*401/);
  });

  it('throws when createdOrders is empty', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ createdOrders: [], errorsCount: 1, successCount: 0 }),
      text: async () => '',
    });
    const p = new RoyalMailClickDropProvider({
      apiKey: 'k',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    await expect(p.createShipment(baseInput)).rejects.toThrow(/no createdOrders/i);
  });
});

describe('RoyalMailClickDropProvider.getLabel', () => {
  it('GETs /orders/:id/label with bearer auth and returns binary PDF buffer', async () => {
    const pdfBytes = Buffer.from('%PDF-1.4 fake');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () =>
        pdfBytes.buffer.slice(
          pdfBytes.byteOffset,
          pdfBytes.byteOffset + pdfBytes.byteLength,
        ) as ArrayBuffer,
    });
    const p = new RoyalMailClickDropProvider({
      apiKey: 'rm-key',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    const buf = await p.getLabel('12345');
    expect(buf.equals(pdfBytes)).toBe(true);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.parcel.royalmail.com/api/v1/orders/12345/label');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer rm-key');
    expect(headers.Accept).toContain('application/pdf');
  });

  it('throws on non-2xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'not found',
    });
    const p = new RoyalMailClickDropProvider({
      apiKey: 'k',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    await expect(p.getLabel('nope')).rejects.toThrow(/Royal Mail.*getLabel.*404/);
  });
});
