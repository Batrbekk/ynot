import { describe, expect, it, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import AdminPromosPage from '../page';

describe('/admin/marketing/promos list page', () => {
  beforeEach(async () => {
    await resetDb();
    const past = new Date(Date.now() - 24 * 3600 * 1000);
    const future = new Date(Date.now() + 24 * 3600 * 1000);
    await prisma.promoCode.createMany({
      data: [
        {
          code: 'WELCOME10',
          discountType: 'PERCENT',
          discountValue: 10,
          isActive: true,
          expiresAt: future,
        },
        {
          code: 'SUMMER5',
          discountType: 'FIXED',
          discountValue: 500,
          isActive: true,
          expiresAt: past,
        },
        {
          code: 'OLDDEAD',
          discountType: 'FIXED',
          discountValue: 100,
          isActive: false,
        },
      ],
    });
  });

  it('default (active) filter renders only WELCOME10', async () => {
    const el = await AdminPromosPage({ searchParams: Promise.resolve({}) });
    const html = renderToString(el);
    expect(html).toContain('WELCOME10');
    expect(html).not.toContain('SUMMER5');
    expect(html).not.toContain('OLDDEAD');
  });

  it('status=expired renders SUMMER5', async () => {
    const el = await AdminPromosPage({
      searchParams: Promise.resolve({ status: 'expired' }),
    });
    const html = renderToString(el);
    expect(html).toContain('SUMMER5');
    expect(html).not.toContain('WELCOME10');
  });

  it('status=deactivated renders OLDDEAD', async () => {
    const el = await AdminPromosPage({
      searchParams: Promise.resolve({ status: 'deactivated' }),
    });
    const html = renderToString(el);
    expect(html).toContain('OLDDEAD');
  });

  it('status=all renders all three', async () => {
    const el = await AdminPromosPage({
      searchParams: Promise.resolve({ status: 'all' }),
    });
    const html = renderToString(el);
    expect(html).toContain('WELCOME10');
    expect(html).toContain('SUMMER5');
    expect(html).toContain('OLDDEAD');
  });

  it('shows discount summary + new promo link', async () => {
    const el = await AdminPromosPage({
      searchParams: Promise.resolve({ status: 'all' }),
    });
    const html = renderToString(el);
    expect(html).toContain('10%'); // PERCENT 10
    expect(html).toContain('£5.00'); // FIXED 500 pence
    expect(html).toContain('/admin/marketing/promos/new');
  });
});
