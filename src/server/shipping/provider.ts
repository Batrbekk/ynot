export interface ShippingRateRequest {
  origin: { country: 'GB' };
  destination: {
    countryCode: string; // ISO-3166 alpha-2
    postcode?: string;
  };
  items: Array<{
    productId: string;
    quantity: number;
    weightGrams: number;
    unitPriceCents: number;
    hsCode?: string;
    countryOfOriginCode?: string;
  }>;
  subtotalCents: number;
}

export interface ShippingRateQuote {
  methodId: string;
  name: string;
  carrier: 'ROYAL_MAIL' | 'DHL';
  baseRateCents: number;
  dutiesCents: number;
  totalCents: number;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
}

export interface ShippingRateProvider {
  quote(req: ShippingRateRequest): Promise<ShippingRateQuote[]>;
}
