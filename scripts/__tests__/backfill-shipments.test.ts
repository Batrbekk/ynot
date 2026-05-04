import { describe, expect, it, beforeEach } from 'vitest';
import { prisma } from '@/server/db/client';
import { backfillShipments } from '../backfill-shipments';

describe('backfillShipments', () => {
  beforeEach(async () => {
    await prisma.shipment.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
  });

  it('creates one Shipment per Order with status NEW or beyond, and links every OrderItem', async () => {
    const order = await prisma.order.create({
      data: {
        orderNumber: 'YN-2026-00001',
        status: 'SHIPPED',
        carrier: 'ROYAL_MAIL',
        trackingNumber: 'RM12345',
        subtotalCents: 20000,
        shippingCents: 0,
        totalCents: 20000,
        shipFirstName: 'Test',
        shipLastName: 'User',
        shipLine1: '1 St',
        shipCity: 'London',
        shipPostcode: 'SW1',
        shipCountry: 'GB',
        shipPhone: '',
        items: {
          create: [
            {
              productSlug: 'a',
              productName: 'A',
              productImage: '',
              colour: 'X',
              size: 'M',
              unitPriceCents: 10000,
              quantity: 1,
            },
            {
              productSlug: 'b',
              productName: 'B',
              productImage: '',
              colour: 'X',
              size: 'M',
              unitPriceCents: 10000,
              quantity: 1,
            },
          ],
        },
      },
    });

    const result = await backfillShipments();

    expect(result.shipmentsCreated).toBe(1);
    const shipment = await prisma.shipment.findFirst({ where: { orderId: order.id } });
    expect(shipment).not.toBeNull();
    expect(shipment!.trackingNumber).toBe('RM12345');
    expect(shipment!.carrier).toBe('ROYAL_MAIL');
    const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
    expect(items.every((i) => i.shipmentId === shipment!.id)).toBe(true);
  });

  it('is idempotent — running twice does not duplicate Shipments', async () => {
    await prisma.order.create({
      data: {
        orderNumber: 'YN-2026-00002',
        status: 'NEW',
        carrier: 'DHL',
        subtotalCents: 50000,
        shippingCents: 4500,
        totalCents: 54500,
        shipFirstName: 'Test',
        shipLastName: 'User',
        shipLine1: '1 St',
        shipCity: 'Berlin',
        shipPostcode: '10115',
        shipCountry: 'DE',
        shipPhone: '',
        items: {
          create: [
            {
              productSlug: 'a',
              productName: 'A',
              productImage: '',
              colour: 'X',
              size: 'L',
              unitPriceCents: 50000,
              quantity: 1,
            },
          ],
        },
      },
    });
    await backfillShipments();
    await backfillShipments();
    const count = await prisma.shipment.count();
    expect(count).toBe(1);
  });

  it('skips Orders with status PENDING_PAYMENT or PAYMENT_FAILED', async () => {
    await prisma.order.create({
      data: {
        orderNumber: 'YN-2026-00003',
        status: 'PENDING_PAYMENT',
        carrier: 'ROYAL_MAIL',
        subtotalCents: 1000,
        shippingCents: 0,
        totalCents: 1000,
        shipFirstName: 'X',
        shipLastName: 'Y',
        shipLine1: '1',
        shipCity: 'L',
        shipPostcode: 'A1',
        shipCountry: 'GB',
        shipPhone: '',
        items: {
          create: [
            {
              productSlug: 'a',
              productName: 'A',
              productImage: '',
              colour: 'X',
              size: 'M',
              unitPriceCents: 1000,
              quantity: 1,
            },
          ],
        },
      },
    });
    const result = await backfillShipments();
    expect(result.shipmentsCreated).toBe(0);
  });
});
