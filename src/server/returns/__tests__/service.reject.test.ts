import { describe, expect, it, beforeEach, vi } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';
import { rejectReturn } from '../service';
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
      slug: 'rj-' + Math.random().toString(36).slice(2, 6),
      name: 'Tee', priceCents: 6000, currency: 'GBP',
      description: '', materials: '', care: '', sizing: '',
      sizes: { create: [{ size: 'M', stock: 5 }] },
      images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
    },
  });
  const user = await prisma.user.create({
    data: { email: 'rj-' + Math.random().toString(36).slice(2, 6) + '@x.com', isGuest: false },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: 'YN-2026-RJ' + Math.random().toString(36).slice(2, 6).toUpperCase(),
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
      returnNumber: 'RT-2026-R' + Math.random().toString(36).slice(2, 5).toUpperCase(),
      reason: 'doesnt fit', reasonCategory: 'DOES_NOT_FIT',
      status: 'RECEIVED',
      items: { create: [{ orderItemId: order.items[0].id, quantity: 1 }] },
    },
    include: { items: true },
  });
  return { order, product, user, ret };
}

describe('rejectReturn', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('marks REJECTED, persists reason + notes, sends RefundRejected email', async () => {
    const { ret } = await seedReceivedReturn();
    const emailService = fakeEmailService();

    const updated = await rejectReturn(
      ret.id,
      {
        rejectionReason: 'tags removed',
        inspectionNotes: 'tag had been cut off',
        actorId: 'admin-2',
      },
      { emailService },
    );

    expect(updated.status).toBe('REJECTED');
    expect(updated.rejectionReason).toBe('tags removed');
    expect(updated.inspectionNotes).toBe('tag had been cut off');
    expect(updated.rejectedAt).not.toBeNull();
    expect(updated.approvedBy).toBe('admin-2');

    expect(emailService.send).toHaveBeenCalledTimes(1);
    const sent = emailService.send.mock.calls[0][0];
    expect(sent.subject).toContain(ret.returnNumber);
  });

  it('throws on already-terminal returns', async () => {
    const { ret } = await seedReceivedReturn();
    await prisma.return.update({
      where: { id: ret.id }, data: { status: 'CANCELLED' },
    });
    await expect(
      rejectReturn(
        ret.id,
        { rejectionReason: 'x', inspectionNotes: 'y', actorId: 'a' },
        { emailService: fakeEmailService() },
      ),
    ).rejects.toThrow(/already CANCELLED/);
  });

  it('skips email for guest order without a user', async () => {
    const { ret, order } = await seedReceivedReturn();
    await prisma.order.update({ where: { id: order.id }, data: { userId: null } });
    const emailService = fakeEmailService();
    await rejectReturn(
      ret.id,
      { rejectionReason: 'x', inspectionNotes: 'y', actorId: 'a' },
      { emailService },
    );
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('throws when the Return does not exist', async () => {
    await expect(
      rejectReturn(
        'nope',
        { rejectionReason: 'x', inspectionNotes: 'y', actorId: 'a' },
      ),
    ).rejects.toThrow(/not found/);
  });
});
