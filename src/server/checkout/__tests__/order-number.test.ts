import { describe, expect, it, beforeEach } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { nextOrderNumber } from '../order-number';

describe('nextOrderNumber', () => {
  beforeEach(async () => { await resetDb(); });

  it('returns YN-YYYY-00001 on first call', async () => {
    const result = await prisma.$transaction((tx) => nextOrderNumber(tx));
    const year = new Date().getUTCFullYear();
    expect(result).toBe(`YN-${year}-00001`);
  });

  it('monotonically increments across calls', async () => {
    const a = await prisma.$transaction((tx) => nextOrderNumber(tx));
    const b = await prisma.$transaction((tx) => nextOrderNumber(tx));
    const c = await prisma.$transaction((tx) => nextOrderNumber(tx));
    const year = new Date().getUTCFullYear();
    expect(a).toBe(`YN-${year}-00001`);
    expect(b).toBe(`YN-${year}-00002`);
    expect(c).toBe(`YN-${year}-00003`);
  });

  it('zero-pads to 5 digits', async () => {
    // Force the sequence forward.
    await prisma.$executeRawUnsafe(`SELECT setval('order_number_seq', 99998)`);
    const a = await prisma.$transaction((tx) => nextOrderNumber(tx));
    const b = await prisma.$transaction((tx) => nextOrderNumber(tx));
    const year = new Date().getUTCFullYear();
    expect(a).toBe(`YN-${year}-99999`);
    // 6-digit overflow does not zero-pad and does not break.
    expect(b).toBe(`YN-${year}-100000`);
  });
});
