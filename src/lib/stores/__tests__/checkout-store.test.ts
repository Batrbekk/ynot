import { describe, it, expect, beforeEach } from 'vitest';
import { useCheckoutStore } from '../checkout-store';
import type { ShippingAddressT, QuoteResponseT } from '@/lib/schemas/checkout';

const addr: ShippingAddressT = {
  email: 'jane@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  line1: '42 King\'s Road',
  line2: null,
  city: 'London',
  postcode: 'SW3 4ND',
  countryCode: 'GB',
  phone: '+44 7700 900123',
};

const quote: QuoteResponseT = {
  methods: [
    {
      methodId: 'rm-tracked',
      name: 'Royal Mail Tracked',
      carrier: 'ROYAL_MAIL',
      baseRateCents: 0,
      dutiesCents: 0,
      totalCents: 0,
      estimatedDaysMin: 2,
      estimatedDaysMax: 5,
    },
  ],
};

beforeEach(() => {
  useCheckoutStore.setState({ shippingAddress: null, quote: null, selectedMethodId: null });
});

describe('checkout store', () => {
  it('starts empty', () => {
    const s = useCheckoutStore.getState();
    expect(s.shippingAddress).toBeNull();
    expect(s.quote).toBeNull();
    expect(s.selectedMethodId).toBeNull();
  });

  it('setAddress stores the address', () => {
    useCheckoutStore.getState().setAddress(addr);
    expect(useCheckoutStore.getState().shippingAddress?.firstName).toBe('Jane');
  });

  it('setQuote stores the quote', () => {
    useCheckoutStore.getState().setQuote(quote);
    expect(useCheckoutStore.getState().quote?.methods.length).toBe(1);
  });

  it('selectMethod stores the methodId', () => {
    useCheckoutStore.getState().selectMethod('rm-tracked');
    expect(useCheckoutStore.getState().selectedMethodId).toBe('rm-tracked');
  });

  it('reset clears all state', () => {
    useCheckoutStore.getState().setAddress(addr);
    useCheckoutStore.getState().setQuote(quote);
    useCheckoutStore.getState().selectMethod('rm-tracked');
    useCheckoutStore.getState().reset();
    const s = useCheckoutStore.getState();
    expect(s.shippingAddress).toBeNull();
    expect(s.quote).toBeNull();
    expect(s.selectedMethodId).toBeNull();
  });
});
