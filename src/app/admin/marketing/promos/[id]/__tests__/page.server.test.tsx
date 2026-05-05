import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

import AdminPromoDetailPage from '../page';

describe('/admin/marketing/promos/[id] detail page', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('renders edit form with code shown read-only', async () => {
    const p = await prisma.promoCode.create({
      data: {
        code: 'WELCOME10',
        discountType: 'PERCENT',
        discountValue: 10,
        minOrderCents: 0,
        isActive: true,
      },
    });
    const el = await AdminPromoDetailPage({
      params: Promise.resolve({ id: p.id }),
    });
    const html = renderToString(el);
    expect(html).toContain('WELCOME10');
    // The code field should render as a static span, not an editable input.
    expect(html).toMatch(/readonly|disabled|<span[^>]*>WELCOME10</i);
  });

  it('throws notFound for unknown id', async () => {
    await expect(
      AdminPromoDetailPage({ params: Promise.resolve({ id: 'nope' }) }),
    ).rejects.toThrow(/NEXT_NOT_FOUND/);
  });
});
