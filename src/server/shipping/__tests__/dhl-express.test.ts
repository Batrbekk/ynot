import { describe, expect, it, vi } from 'vitest';
import { DhlExpressProvider } from '../dhl-express';
import type { LandedCostInput } from '../provider';

describe('DhlExpressProvider.getRate', () => {
  it('calls MyDHL rates endpoint and returns parsed quote', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        products: [
          {
            productCode: 'P',
            productName: 'EXPRESS WORLDWIDE',
            totalPrice: [{ currencyType: 'BILLC', priceCurrency: 'GBP', price: 45.5 }],
            deliveryCapabilities: { totalTransitDays: '2' },
          },
        ],
      }),
      text: async () => '',
    });
    const p = new DhlExpressProvider({
      apiKey: 'k',
      apiSecret: 's',
      accountNumber: '230200799',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    const r = await p.getRate({
      destinationCountry: 'DE',
      destinationPostcode: '10115',
      weightGrams: 800,
      declaredValueCents: 20000,
    });
    expect(r.baseRateCents).toBe(4550);
    expect(r.currency).toBe('GBP');
    expect(r.estimatedDaysMin).toBe(2);
    expect(r.estimatedDaysMax).toBe(2);
    expect(r.name).toContain('DHL');
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://express.api.dhl.com/mydhlapi/rates');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${Buffer.from('k:s').toString('base64')}`);
    expect(headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body as string);
    expect(body.accounts[0].number).toBe('230200799');
    expect(body.customerDetails.shipperDetails.countryCode).toBe('GB');
    expect(body.customerDetails.receiverDetails.countryCode).toBe('DE');
    expect(body.isCustomsDeclarable).toBe(true);
  });

  it('falls back to first totalPrice entry when no BILLC currency', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        products: [
          {
            totalPrice: [{ currencyType: 'PULCL', priceCurrency: 'GBP', price: 30 }],
            deliveryCapabilities: { totalTransitDays: '3' },
          },
        ],
      }),
      text: async () => '',
    });
    const p = new DhlExpressProvider({
      apiKey: 'k',
      apiSecret: 's',
      accountNumber: 'a',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    const r = await p.getRate({
      destinationCountry: 'GB',
      destinationPostcode: 'SW7 5QG',
      weightGrams: 500,
      declaredValueCents: 10000,
    });
    expect(r.baseRateCents).toBe(3000);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(init.body as string).isCustomsDeclarable).toBe(false);
  });

  it('throws on non-2xx including the DHL provider name + status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'service unavailable',
    });
    const p = new DhlExpressProvider({
      apiKey: 'k',
      apiSecret: 's',
      accountNumber: 'x',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    await expect(
      p.getRate({
        destinationCountry: 'DE',
        destinationPostcode: '10115',
        weightGrams: 1,
        declaredValueCents: 1,
      }),
    ).rejects.toThrow(/DHL.*503/);
  });

  it('throws when products array is empty', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ products: [] }),
      text: async () => '',
    });
    const p = new DhlExpressProvider({
      apiKey: 'k',
      apiSecret: 's',
      accountNumber: 'x',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    await expect(
      p.getRate({
        destinationCountry: 'DE',
        destinationPostcode: '10115',
        weightGrams: 1,
        declaredValueCents: 1,
      }),
    ).rejects.toThrow(/no products/i);
  });
});

describe('DhlExpressProvider.landedCost', () => {
  const sampleInput: LandedCostInput = {
    destinationCountry: 'DE',
    items: [
      {
        productSlug: 'silk-scarf',
        hsCode: '6201',
        weightGrams: 800,
        unitPriceCents: 20000,
        quantity: 1,
        countryOfOriginCode: 'CN',
      },
    ],
  };

  it('calls landed-cost endpoint and parses dutyCents/taxCents', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        products: [
          {
            landedCost: { totalDutyAmount: 12.5, totalTaxAmount: 7.5, currency: 'GBP' },
            items: [],
          },
        ],
      }),
      text: async () => '',
    });
    const p = new DhlExpressProvider({
      apiKey: 'k',
      apiSecret: 's',
      accountNumber: 'a',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    const q = await p.landedCost(sampleInput);
    expect(q.dutyCents).toBe(1250);
    expect(q.taxCents).toBe(750);
    expect(q.currency).toBe('GBP');
    expect(q.breakdown).toEqual([]);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://express.api.dhl.com/mydhlapi/landed-cost');
    const body = JSON.parse(init.body as string);
    expect(body.isCustomsDeclarable).toBe(true);
    expect(body.items[0].partNumber).toBe('silk-scarf');
    expect(body.items[0].commodityCode).toBe('6201');
    expect(body.items[0].manufacturerCountry).toBe('CN');
    expect(body.items[0].customsValue).toBe(200);
  });

  it('parses per-item breakdown', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        products: [
          {
            landedCost: { totalDutyAmount: 20, totalTaxAmount: 10 },
            items: [
              { partNumber: 'silk-scarf', commodityCode: '6201', dutyAmount: 20, taxAmount: 10 },
            ],
          },
        ],
      }),
      text: async () => '',
    });
    const p = new DhlExpressProvider({
      apiKey: 'k',
      apiSecret: 's',
      accountNumber: 'a',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    const q = await p.landedCost(sampleInput);
    expect(q.breakdown).toEqual([
      { productSlug: 'silk-scarf', hsCode: '6201', dutyCents: 2000, taxCents: 1000 },
    ]);
  });

  it('throws on non-2xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => 'bad gateway',
    });
    const p = new DhlExpressProvider({
      apiKey: 'k',
      apiSecret: 's',
      accountNumber: 'a',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    await expect(p.landedCost(sampleInput)).rejects.toThrow(/DHL.*landed-cost.*502/);
  });

  it('falls back to GB origin and default HS code when not supplied', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ products: [{ landedCost: {} }] }),
      text: async () => '',
    });
    const p = new DhlExpressProvider({
      apiKey: 'k',
      apiSecret: 's',
      accountNumber: 'a',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    await p.landedCost({
      destinationCountry: 'US',
      items: [
        {
          productSlug: 'belt',
          hsCode: null,
          weightGrams: 200,
          unitPriceCents: 5000,
          quantity: 3,
          countryOfOriginCode: null,
        },
      ],
    });
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.items[0].manufacturerCountry).toBe('GB');
    expect(body.items[0].commodityCode).toBe('6217.10.00');
    expect(body.items[0].customsValue).toBe(150); // 5000c * 3 / 100
  });
});
