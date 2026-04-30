import { create } from 'zustand';
import type { ShippingAddressT, QuoteResponseT } from '@/lib/schemas/checkout';

interface CheckoutState {
  shippingAddress: ShippingAddressT | null;
  quote: QuoteResponseT | null;
  selectedMethodId: string | null;
  setAddress: (address: ShippingAddressT) => void;
  setQuote: (quote: QuoteResponseT) => void;
  selectMethod: (methodId: string) => void;
  reset: () => void;
}

export const useCheckoutStore = create<CheckoutState>()((set) => ({
  shippingAddress: null,
  quote: null,
  selectedMethodId: null,
  setAddress: (shippingAddress) => set({ shippingAddress }),
  setQuote: (quote) => set({ quote }),
  selectMethod: (selectedMethodId) => set({ selectedMethodId }),
  reset: () => set({ shippingAddress: null, quote: null, selectedMethodId: null }),
}));
