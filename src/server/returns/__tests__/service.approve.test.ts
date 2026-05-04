import { describe, expect, it, beforeEach, vi } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';
import { approveReturn } from '../service';
import type { EmailService } from '@/server/email';

function fakeEmailService(): EmailService & { send: ReturnType<typeof vi.fn> } {
  const send = vi.fn(async () => ({ id: 'em_1' }));
  return { send } as unknown as EmailService & {
    send: ReturnType<typeof vi.fn>;
  };
}

async function seedReceivedReturn() {
  const product = await prisma.product.create({
    data: {
      slug: 'ar-' + Math.random().toString(36).slice(2, 6),
      name: 'Tee', priceCents: 6000, currency: 'GBP',
      description: '', materials: '', care: '', sizing: '',
      sizes: { create: [{ size: 'M', stock: 5 }] },
      images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
    },
  });
  const user = await prisma.user.create({
    data: { email: 'ar-' + Math.random().toString(36).slice(2, 6) + '@x.com', isGuest: false },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: 'YN-2026-AR' + Math.random().toString(36).slice(2, 6).toUpperCase(),
      status: 'DELIVERED', userId: user.id,
      subtotalCents: 6000, shippingCents: 0, discountCents: 0,
      totalCents: 6000, currency: 'GBP', carrier: 'ROYAL_MAIL',
      shipFirstName: 'Alice', shipLastName: 'B', shipLine1: '1',
      shipCity: 'L', shipPostcode: 'SW1', shipCountry: 'GB', shipPhone: '+44',
      items: {
        create: [{
          productId: product.id, productSlug: product.slug, productName: 'Tee',
          productImage: '/x.jpg', colour: 'Black', size: 'M',
          unitPriceCents: 6000, currency: 'GBP', quantity: 1,
        }],
      },
      shipments: {
        create: [{ carrier: 'ROYAL_MAIL', deliveredAt: new Date() }],
      },
    },
    include: { items: true },
  });
  const ret = await prisma.return.create({
    data: {
      orderId: order.id,
      returnNumber: 'RT-2026-T' + Math.random().toString(36).slice(2, 5).toUpperCase(),
      reason: 'doesnt fit', reasonCategory: 'DOES_NOT_FIT',
      status: 'RECEIVED',
      items: { create: [{ orderItemId: order.items[0].id, quantity: 1 }] },
    },
    include: { items: true },
  });
  return { order, product, user, ret };
}

describe('approveReturn', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('calls refundForReturn, marks APPROVED, sends RefundIssued email', async () => {
    const { ret } = await seedReceivedReturn();
    const refundForReturn = vi.fn(async () => ({
      refundId: 're_1', amountCents: 6000,
    }));
    const emailService = fakeEmailService();

    const updated = await approveReturn(
      ret.id,
      {
        acceptedItemIds: [ret.items[0].id],
        inspectionNotes: 'looks good',
        actorId: 'admin-1',
      },
      { refundForReturn, emailService },
    );

    expect(updated.status).toBe('APPROVED');
    expect(updated.approvedBy).toBe('admin-1');
    expect(updated.approvedAt).not.toBeNull();
    expect(updated.refundedAt).not.toBeNull();
    expect(updated.refundAmountCents).toBe(6000);
    expect(updated.inspectionNotes).toBe('looks good');

    expect(refundForReturn).toHaveBeenCalledWith(ret.id, [ret.items[0].id]);
    expect(emailService.send).toHaveBeenCalledTimes(1);
    const sent = emailService.send.mock.calls[0][0];
    expect(sent.subject).toContain(ret.returnNumber);
  });

  it('throws when an accepted ReturnItem id does not belong to the Return', async () => {
    const { ret } = await seedReceivedReturn();
    await expect(
      approveReturn(
        ret.id,
        { acceptedItemIds: ['not-on-return'], actorId: 'admin-1' },
        {
          refundForReturn: vi.fn(async () => ({ refundId: 'r', amountCents: 0 })),
          emailService: fakeEmailService(),
        },
      ),
    ).rejects.toThrow(/does not belong/);
  });

  it('throws on empty acceptedItemIds', async () => {
    const { ret } = await seedReceivedReturn();
    await expect(
      approveReturn(
        ret.id,
        { acceptedItemIds: [], actorId: 'admin-1' },
        {
          refundForReturn: vi.fn(async () => ({ refundId: 'r', amountCents: 0 })),
          emailService: fakeEmailService(),
        },
      ),
    ).rejects.toThrow(/at least one/i);
  });

  it('throws when the Return is already APPROVED', async () => {
    const { ret } = await seedReceivedReturn();
    await prisma.return.update({
      where: { id: ret.id }, data: { status: 'APPROVED' },
    });
    await expect(
      approveReturn(
        ret.id,
        { acceptedItemIds: [ret.items[0].id], actorId: 'admin-1' },
        {
          refundForReturn: vi.fn(async () => ({ refundId: 'r', amountCents: 0 })),
          emailService: fakeEmailService(),
        },
      ),
    ).rejects.toThrow(/already APPROVED/);
  });

  it('skips email when the order has no associated user', async () => {
    const { ret, order } = await seedReceivedReturn();
    await prisma.order.update({ where: { id: order.id }, data: { userId: null } });
    const emailService = fakeEmailService();
    await approveReturn(
      ret.id,
      { acceptedItemIds: [ret.items[0].id], actorId: 'admin-1' },
      {
        refundForReturn: vi.fn(async () => ({ refundId: 'r', amountCents: 6000 })),
        emailService,
      },
    );
    expect(emailService.send).not.toHaveBeenCalled();
  });
});
