import { describe, expect, it, beforeEach, vi } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';

vi.mock('@/server/auth/nextauth', () => ({ auth: vi.fn() }));

import { auth } from '@/server/auth/nextauth';
import { DELETE } from '../route';

describe('DELETE /api/admin/products/[id]/images/[imgId]', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'OWNER' } });
  });

  it('403 when not OWNER', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'CUSTOMER' } });
    const req = new Request('http://x', { method: 'DELETE' });
    const res = await DELETE(req, {
      params: Promise.resolve({ id: 'pid', imgId: 'iid' }),
    });
    expect(res.status).toBe(403);
  });

  it('removes image', async () => {
    const p = await prisma.product.create({
      data: {
        name: 'Coat',
        slug: 'coat-x',
        description: 'd',
        priceCents: 1000,
        materials: '',
        care: '',
        sizing: '',
        status: 'DRAFT',
      },
    });
    const img = await prisma.productImage.create({
      data: { productId: p.id, url: 'https://x.test/1.jpg', alt: '', sortOrder: 0 },
    });
    const req = new Request('http://x', { method: 'DELETE' });
    const res = await DELETE(req, {
      params: Promise.resolve({ id: p.id, imgId: img.id }),
    });
    expect(res.status).toBe(200);
    const found = await prisma.productImage.findUnique({ where: { id: img.id } });
    expect(found).toBeNull();
  });
});
