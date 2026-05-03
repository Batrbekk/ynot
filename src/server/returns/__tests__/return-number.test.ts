import { describe, expect, it, beforeEach } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';
import { nextReturnNumber } from '../return-number';

describe('nextReturnNumber', () => {
  beforeEach(async () => {
    await resetDb();
    // resetDb only restarts order_number_seq; reset return_number_seq for
    // determinism inside this suite.
    await prisma.$executeRawUnsafe(
      `ALTER SEQUENCE return_number_seq RESTART WITH 1`,
    );
  });

  it('returns RT-<year>-00001 on first call', async () => {
    const n = await prisma.$transaction((tx) => nextReturnNumber(tx));
    const year = new Date().getUTCFullYear();
    expect(n).toBe(`RT-${year}-00001`);
  });

  it('increments on subsequent calls', async () => {
    const a = await prisma.$transaction((tx) => nextReturnNumber(tx));
    const b = await prisma.$transaction((tx) => nextReturnNumber(tx));
    const c = await prisma.$transaction((tx) => nextReturnNumber(tx));
    const year = new Date().getUTCFullYear();
    expect(a).toBe(`RT-${year}-00001`);
    expect(b).toBe(`RT-${year}-00002`);
    expect(c).toBe(`RT-${year}-00003`);
  });

  it('zero-pads to five digits', async () => {
    await prisma.$executeRawUnsafe(
      `ALTER SEQUENCE return_number_seq RESTART WITH 42`,
    );
    const n = await prisma.$transaction((tx) => nextReturnNumber(tx));
    expect(n).toMatch(/RT-\d{4}-00042/);
  });
});
