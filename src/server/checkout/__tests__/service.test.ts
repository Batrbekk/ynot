import { describe, expect, it, beforeEach, vi } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';
import { mockStripeSdk } from '@/server/__tests__/helpers/mock-stripe';
import { addItem, getOrCreateCart } from '@/server/cart/service';
import { generateCartToken } from '@/server/cart/token';
import { seedShipping } from '../../../../tests/seeds/shipping';

describe('createOrderAndPaymentIntent', () => {
  beforeEach(async () => {
    vi.resetModules();
    await resetDb();
    await seedShipping(prisma);
  });

  async function seedCartWithItem(opts: { stock?: number; price?: number } = {}) {
    const product = await prisma.product.create({
      data: {
        slug: 'p-' + Math.random().toString(36).slice(2, 6),
        name: 'P', priceCents: opts.price ?? 20000, currency: 'GBP',
        description: '', materials: '', care: '', sizing: '',
        weightGrams: 1500, hsCode: '6202.93', countryOfOriginCode: 'GB',
        sizes: { create: [{ size: 'S', stock: opts.stock ?? 5 }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });
    const cart = await getOrCreateCart({ userId: null, sessionToken: generateCartToken() });
    await addItem(cart.id, { productId: product.id, size: 'S', colour: 'Black', quantity: 1, isPreorder: false });
    return { cart, product };
  }

  it('creates Order(PENDING_PAYMENT) + OrderItem + Payment + decrements stock', async () => {
    const stripe = mockStripeSdk();
    const { createOrderAndPaymentIntent } = await import('../service');
    const { cart, product } = await seedCartWithItem({ stock: 3 });

    const result = await createOrderAndPaymentIntent({
      cartId: cart.id,
      user: null,
      address: {
        email: 'g@x.com', firstName: 'G', lastName: 'X',
        line1: '1 St', city: 'London', postcode: 'SW1', countryCode: 'GB', phone: '+440000000000',
      },
      methodId: 'method-uk-rm-tracked48',
      attribution: null,
    });

    expect(result.orderId).toBeDefined();
    expect(result.clientSecret).toBe(stripe.clientSecret);
    expect(stripe.create).toHaveBeenCalledTimes(1);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: result.orderId }, include: { items: true, payment: true, user: true },
    });
    expect(order.status).toBe('PENDING_PAYMENT');
    expect(order.items).toHaveLength(1);
    expect(order.items[0].productId).toBe(product.id);
    expect(order.payment?.status).toBe('PENDING');
    expect(order.payment?.stripePaymentIntentId).toBe(stripe.intentId);
    expect(order.user?.isGuest).toBe(true);

    const stock = await prisma.productSize.findUniqueOrThrow({
      where: { productId_size: { productId: product.id, size: 'S' } },
    });
    expect(stock.stock).toBe(2); // 3 - 1
  });

  it('throws StockConflictError when stock insufficient', async () => {
    mockStripeSdk();
    const { createOrderAndPaymentIntent } = await import('../service');
    const { cart } = await seedCartWithItem({ stock: 1 });
    // Manually inflate cart qty above stock to simulate race.
    await prisma.cartItem.updateMany({ where: { cartId: cart.id }, data: { quantity: 3 } });

    await expect(
      createOrderAndPaymentIntent({
        cartId: cart.id,
        user: null,
        address: {
          email: 'g@x.com', firstName: 'G', lastName: 'X',
          line1: '1', city: 'London', postcode: 'SW1', countryCode: 'GB', phone: '+44',
        },
        methodId: 'method-uk-rm-tracked48',
        attribution: null,
      }),
    ).rejects.toThrow(/stock/i);
  });

  it('creates Shipments and links each OrderItem.shipmentId', async () => {
    mockStripeSdk();
    const { createOrderAndPaymentIntent } = await import('../service');
    const { cart, product } = await seedCartWithItem({ stock: 3 });

    const result = await createOrderAndPaymentIntent({
      cartId: cart.id,
      user: null,
      address: {
        email: 'g@x.com', firstName: 'G', lastName: 'X',
        line1: '1 St', city: 'London', postcode: 'SW1', countryCode: 'GB', phone: '+440000000000',
      },
      methodId: 'method-uk-rm-tracked48',
      attribution: null,
    });

    const shipments = await prisma.shipment.findMany({
      where: { orderId: result.orderId }, include: { items: true },
    });
    expect(shipments).toHaveLength(1);
    expect(shipments[0].carrier).toBe('ROYAL_MAIL');
    expect(shipments[0].items).toHaveLength(1);
    expect(shipments[0].items[0].productId).toBe(product.id);

    const item = await prisma.orderItem.findFirstOrThrow({
      where: { orderId: result.orderId },
    });
    expect(item.shipmentId).toBe(shipments[0].id);
  });

  it('non-UK destination produces a DHL Shipment', async () => {
    mockStripeSdk();
    const { createOrderAndPaymentIntent } = await import('../service');
    const { cart } = await seedCartWithItem({ stock: 3 });

    const result = await createOrderAndPaymentIntent({
      cartId: cart.id,
      user: null,
      address: {
        email: 'g@x.com', firstName: 'G', lastName: 'X',
        line1: '1 Berliner Str', city: 'Berlin', postcode: '10115',
        countryCode: 'DE', phone: '+490000000000',
      },
      methodId: 'method-intl-dhl-express',
      attribution: null,
    });

    const shipments = await prisma.shipment.findMany({
      where: { orderId: result.orderId },
    });
    expect(shipments).toHaveLength(1);
    expect(shipments[0].carrier).toBe('DHL');
  });

  it('reuses existing ghost user for the same email', async () => {
    mockStripeSdk();
    const { createOrderAndPaymentIntent } = await import('../service');
    const { cart: cart1 } = await seedCartWithItem({ stock: 5 });
    const { cart: cart2 } = await seedCartWithItem({ stock: 5 });

    const r1 = await createOrderAndPaymentIntent({
      cartId: cart1.id, user: null,
      address: { email: 'g@x.com', firstName: 'G', lastName: 'X', line1: '1', city: 'L', postcode: 'SW1', countryCode: 'GB', phone: '+44' },
      methodId: 'method-uk-rm-tracked48', attribution: null,
    });
    const r2 = await createOrderAndPaymentIntent({
      cartId: cart2.id, user: null,
      address: { email: 'g@x.com', firstName: 'G', lastName: 'X', line1: '1', city: 'L', postcode: 'SW1', countryCode: 'GB', phone: '+44' },
      methodId: 'method-uk-rm-tracked48', attribution: null,
    });
    const o1 = await prisma.order.findUniqueOrThrow({ where: { id: r1.orderId } });
    const o2 = await prisma.order.findUniqueOrThrow({ where: { id: r2.orderId } });
    expect(o1.userId).toBe(o2.userId);
  });
});
