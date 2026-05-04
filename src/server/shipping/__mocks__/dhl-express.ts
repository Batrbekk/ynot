/**
 * In-memory mock of {@link DhlExpressProvider} for downstream tests
 * (Group H wires it as the carrier choice when DHL credentials are absent).
 *
 * The shape mirrors the real provider but never touches the network.
 */
import type {
  CreateShipmentInput,
  CreateShipmentResult,
  GetRateInput,
  LandedCostInput,
  LandedCostQuote,
  ShippingQuote,
  ShippingRateProvider,
} from '../provider';

export class DhlExpressProvider implements ShippingRateProvider {
  async getRate(_input: GetRateInput): Promise<ShippingQuote> {
    return {
      name: 'Mock DHL Express',
      baseRateCents: 4500,
      currency: 'GBP',
      estimatedDaysMin: 2,
      estimatedDaysMax: 4,
    };
  }

  async landedCost(_input: LandedCostInput): Promise<LandedCostQuote> {
    return { dutyCents: 1500, taxCents: 1000, currency: 'GBP', breakdown: [] };
  }

  async createShipment(_input: CreateShipmentInput): Promise<CreateShipmentResult> {
    return {
      trackingNumber: 'MOCK-DHL-1',
      labelPdfBytes: Buffer.from('PDF'),
      customsInvoicePdfBytes: Buffer.from('CUSTOMS'),
    };
  }
}
