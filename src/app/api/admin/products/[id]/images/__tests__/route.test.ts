import { describe, expect, it, beforeEach, vi } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';

vi.mock('@/server/auth/nextauth', () => ({ auth: vi.fn() }));

import { auth } from '@/server/auth/nextauth';
import { POST, PATCH } from '../route';

async function seedProduct() {
  await resetDb();
  await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
  return prisma.product.create({
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
}

describe('POST /api/admin/products/[id]/images', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'OWNER' } });
  });

  it('403 when not OWNER', async () => {
    const p = await seedProduct();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'CUSTOMER' } });
    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ items: [{ url: 'https://x.test/a.jpg' }] }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: p.id }) });
    expect(res.status).toBe(403);
  });

  it('400 on invalid body', async () => {
    const p = await seedProduct();
    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ items: [] }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: p.id }) });
    expect(res.status).toBe(400);
  });

  it('201 — creates image rows', async () => {
    const p = await seedProduct();
    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ items: [{ url: 'https://x.test/a.jpg', alt: 'a' }] }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: p.id }) });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].url).toBe('https://x.test/a.jpg');
  });
});

describe('PATCH /api/admin/products/[id]/images', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'OWNER' } });
  });

  it('reorders images by id', async () => {
    const p = await seedProduct();
    const i1 = await prisma.productImage.create({
      data: { productId: p.id, url: 'https://x.test/1.jpg', alt: '', sortOrder: 0 },
    });
    const i2 = await prisma.productImage.create({
      data: { productId: p.id, url: 'https://x.test/2.jpg', alt: '', sortOrder: 1 },
    });
    const req = new Request('http://x', {
      method: 'PATCH',
      body: JSON.stringify({ order: [i2.id, i1.id] }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: p.id }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data[0].id).toBe(i2.id);
    expect(data[1].id).toBe(i1.id);
  });
});
