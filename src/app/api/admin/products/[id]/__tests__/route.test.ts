import { describe, expect, it, beforeEach, vi } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';

vi.mock('@/server/auth/nextauth', () => ({ auth: vi.fn() }));

import { auth } from '@/server/auth/nextauth';
import { PATCH, DELETE } from '../route';

async function seed() {
  await resetDb();
  await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
  const p = await prisma.product.create({
    data: {
      name: 'Coat',
      slug: 'coat',
      description: 'd',
      priceCents: 1000,
      materials: '',
      care: '',
      sizing: '',
      status: 'DRAFT',
    },
  });
  return p;
}

describe('PATCH /api/admin/products/[id]', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'OWNER' } });
  });

  it('403 when not OWNER', async () => {
    const p = await seed();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'CUSTOMER' } });
    const req = new Request(`http://x/api/admin/products/${p.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'NX' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: p.id }) });
    expect(res.status).toBe(403);
  });

  it('400 on invalid body', async () => {
    const p = await seed();
    const req = new Request(`http://x/api/admin/products/${p.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ priceCents: -10 }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: p.id }) });
    expect(res.status).toBe(400);
  });

  it('200 on success — updates name', async () => {
    const p = await seed();
    const req = new Request(`http://x/api/admin/products/${p.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'New Coat' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: p.id }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe('New Coat');
  });
});

describe('DELETE /api/admin/products/[id]', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'OWNER' } });
  });

  it('403 when not OWNER', async () => {
    const p = await seed();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'CUSTOMER' } });
    const req = new Request(`http://x/api/admin/products/${p.id}`, { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: p.id }) });
    expect(res.status).toBe(403);
  });

  it('archives the product (soft delete)', async () => {
    const p = await seed();
    // DRAFT -> ARCHIVED is a legal transition
    const req = new Request(`http://x/api/admin/products/${p.id}`, { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: p.id }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ARCHIVED');
  });
});
