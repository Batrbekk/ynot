import { describe, expect, it } from 'vitest';
import { isWithinReturnWindow, returnLabelPolicy } from '../policy';

const day = 86400000;

describe('isWithinReturnWindow', () => {
  it('true when delivered within last 14 days', () => {
    const order = {
      shipments: [{ deliveredAt: new Date(Date.now() - 5 * day) }],
    };
    expect(isWithinReturnWindow(order)).toBe(true);
  });

  it('false when delivered more than 14 days ago', () => {
    const order = {
      shipments: [{ deliveredAt: new Date(Date.now() - 20 * day) }],
    };
    expect(isWithinReturnWindow(order)).toBe(false);
  });

  it('true at exactly 14 days (inclusive boundary)', () => {
    const now = new Date('2026-05-15T00:00:00Z');
    const order = {
      shipments: [{ deliveredAt: new Date('2026-05-01T00:00:00Z') }],
    };
    expect(isWithinReturnWindow(order, now)).toBe(true);
  });

  it('false when no shipment has been delivered', () => {
    const order = { shipments: [{ deliveredAt: null }] };
    expect(isWithinReturnWindow(order)).toBe(false);
  });

  it('false when there are zero shipments', () => {
    expect(isWithinReturnWindow({ shipments: [] })).toBe(false);
  });

  it('uses the latest delivery date across multiple shipments', () => {
    // older one is OUT of window; newer one is IN window — latest wins.
    const order = {
      shipments: [
        { deliveredAt: new Date(Date.now() - 30 * day) },
        { deliveredAt: new Date(Date.now() - 3 * day) },
      ],
    };
    expect(isWithinReturnWindow(order)).toBe(true);
  });

  it('mixes null + delivered correctly (null shipments ignored)', () => {
    const order = {
      shipments: [
        { deliveredAt: null },
        { deliveredAt: new Date(Date.now() - 2 * day) },
      ],
    };
    expect(isWithinReturnWindow(order)).toBe(true);
  });
});

describe('returnLabelPolicy', () => {
  it('PREPAID_UK for GB', () => {
    expect(returnLabelPolicy({ shipCountry: 'GB' })).toBe('PREPAID_UK');
  });

  it('CUSTOMER_ARRANGED for any non-GB country', () => {
    expect(returnLabelPolicy({ shipCountry: 'DE' })).toBe('CUSTOMER_ARRANGED');
    expect(returnLabelPolicy({ shipCountry: 'US' })).toBe('CUSTOMER_ARRANGED');
    expect(returnLabelPolicy({ shipCountry: 'FR' })).toBe('CUSTOMER_ARRANGED');
  });
});
