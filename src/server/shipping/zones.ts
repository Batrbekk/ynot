import { env } from '@/server/env';
import { MockDhlProvider } from './mock-dhl';
import { RoyalMailFreeProvider } from './royal-mail';
import type {
  MultiQuoteShippingProvider,
  ShippingRateRequest,
  ShippingRateQuote,
} from './provider';

class CompositeProvider implements MultiQuoteShippingProvider {
  constructor(private readonly providers: MultiQuoteShippingProvider[]) {}
  async quote(req: ShippingRateRequest): Promise<ShippingRateQuote[]> {
    const results = await Promise.all(this.providers.map((p) => p.quote(req)));
    return results.flat();
  }
}

export function getShippingProvider(): MultiQuoteShippingProvider {
  switch (env.SHIPPING_PROVIDER) {
    case 'mock':
      return new CompositeProvider([new RoyalMailFreeProvider(), new MockDhlProvider()]);
    case 'dhl':
      // Phase 5: replace MockDhlProvider with DhlExpressProvider here.
      return new CompositeProvider([new RoyalMailFreeProvider(), new MockDhlProvider()]);
  }
}
