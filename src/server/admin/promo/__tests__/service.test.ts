import { describe, expect, it, beforeEach } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { createPromo, updatePromo, deactivatePromo } from '../service';

describe('createPromo', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
  });

  it('creates a promo with audit row', async () => {
    const promo = await createPromo({
      input: {
        code: 'SAVE10',
        discountType: 'PERCENT',
        discountValue: 10,
        minOrderCents: 0,
        isActive: true,
      },
      actorId: 'u1',
    });
    expect(promo.code).toBe('SAVE10');
    expect(promo.discountType).toBe('PERCENT');
    expect(promo.discountValue).toBe(10);
    expect(promo.isActive).toBe(true);
    const log = await prisma.auditLog.findFirst({
      where: { entityType: 'promo', action: 'promo.create' },
    });
    expect(log).not.toBeNull();
    expect((log!.after as { id: string }).id).toBe(promo.id);
  });

  it('rejects PERCENT discountValue > 100 in service', async () => {
    await expect(
      createPromo({
        input: {
          code: 'BIG200',
          discountType: 'PERCENT',
          discountValue: 200,
          minOrderCents: 0,
          isActive: true,
        },
        actorId: 'u1',
      }),
    ).rejects.toThrow(/percent/i);
  });

  it('rejects duplicate code', async () => {
    await createPromo({
      input: {
        code: 'DUP',
        discountType: 'FIXED',
        discountValue: 500,
        minOrderCents: 0,
        isActive: true,
      },
      actorId: 'u1',
    });
    await expect(
      createPromo({
        input: {
          code: 'DUP',
          discountType: 'FIXED',
          discountValue: 500,
          minOrderCents: 0,
          isActive: true,
        },
        actorId: 'u1',
      }),
    ).rejects.toThrow();
  });
});

describe('updatePromo', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
  });

  it('updates editable fields and writes audit', async () => {
    const created = await createPromo({
      input: {
        code: 'X10',
        discountType: 'PERCENT',
        discountValue: 10,
        minOrderCents: 0,
        isActive: true,
      },
      actorId: 'u1',
    });
    const updated = await updatePromo({
      id: created.id,
      input: { discountValue: 20, minOrderCents: 5000 },
      actorId: 'u1',
    });
    expect(updated.discountValue).toBe(20);
    expect(updated.minOrderCents).toBe(5000);
    expect(updated.code).toBe('X10');
    const log = await prisma.auditLog.findFirst({ where: { action: 'promo.update' } });
    expect(log).not.toBeNull();
  });

  it('throws when promo not found', async () => {
    await expect(
      updatePromo({ id: 'nope', input: { discountValue: 5 }, actorId: 'u1' }),
    ).rejects.toThrow(/not found/i);
  });

  it('rejects PERCENT discountValue > 100 in service', async () => {
    const created = await createPromo({
      input: {
        code: 'PCT',
        discountType: 'PERCENT',
        discountValue: 10,
        minOrderCents: 0,
        isActive: true,
      },
      actorId: 'u1',
    });
    await expect(
      updatePromo({ id: created.id, input: { discountValue: 200 }, actorId: 'u1' }),
    ).rejects.toThrow(/percent/i);
  });
});

describe('deactivatePromo', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
  });

  it('sets isActive=false WITHOUT deleting (preserves redemption FK integrity)', async () => {
    const created = await createPromo({
      input: {
        code: 'KILL',
        discountType: 'FIXED',
        discountValue: 1000,
        minOrderCents: 0,
        isActive: true,
      },
      actorId: 'u1',
    });
    const deactivated = await deactivatePromo({ id: created.id, actorId: 'u1' });
    expect(deactivated.isActive).toBe(false);
    // row still exists
    const found = await prisma.promoCode.findUnique({ where: { id: created.id } });
    expect(found).not.toBeNull();
    expect(found!.isActive).toBe(false);
    const log = await prisma.auditLog.findFirst({ where: { action: 'promo.deactivate' } });
    expect(log).not.toBeNull();
  });

  it('throws when promo not found', async () => {
    await expect(deactivatePromo({ id: 'nope', actorId: 'u1' })).rejects.toThrow(/not found/i);
  });
});
