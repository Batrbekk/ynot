/**
 * In-memory mock of {@link RoyalMailClickDropProvider} for downstream tests
 * (Group H wires it as the carrier choice for UK shipments).
 */
import type { CreateShipmentInput } from '../provider';
import type {
  CreateRmShipmentResult,
  CreateReturnLabelResult,
} from '../royal-mail-click-drop';

export class RoyalMailClickDropProvider {
  async createShipment(_input: CreateShipmentInput): Promise<CreateRmShipmentResult> {
    return { trackingNumber: 'RM-MOCK-1', rmOrderId: 'rm_1' };
  }

  async getLabel(_rmOrderId: string): Promise<Buffer> {
    return Buffer.from('PDF');
  }

  async createReturnLabel(_input: CreateShipmentInput): Promise<CreateReturnLabelResult> {
    return { rmOrderId: 'rm_return_1', labelPdfBytes: Buffer.from('RETURN-PDF') };
  }
}
