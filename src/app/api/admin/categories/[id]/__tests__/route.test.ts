import { describe, expect, it, beforeEach, vi } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';

vi.mock('@/server/auth/nextauth', () => ({ auth: vi.fn() }));

import { auth } from '@/server/auth/nextauth';
import { PATCH, DELETE } from '../route';

async function seed() {
  await resetDb();
  await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
  const cat = await prisma.category.create({
    data: { slug: 'cat', name: 'Cat' },
  });
  return cat;
}

describe('PATCH /api/admin/categories/[id]', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'OWNER' } });
  });

  it('403 when not OWNER', async () => {
    const cat = await seed();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'CUSTOMER' } });
    const req = new Request(`http://x/api/admin/categories/${cat.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'NX' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: cat.id }) });
    expect(res.status).toBe(403);
  });

  it('400 on invalid body', async () => {
    const cat = await seed();
    const req = new Request(`http://x/api/admin/categories/${cat.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: '' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: cat.id }) });
    expect(res.status).toBe(400);
  });

  it('200 on success — updates name', async () => {
    const cat = await seed();
    const req = new Request(`http://x/api/admin/categories/${cat.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'New' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: cat.id }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe('New');
  });

  it('422 when parentId would create a cycle (self-parent)', async () => {
    const cat = await seed();
    const req = new Request(`http://x/api/admin/categories/${cat.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ parentId: cat.id }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: cat.id }) });
    expect(res.status).toBe(422);
  });
});

describe('DELETE /api/admin/categories/[id]', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'OWNER' } });
  });

  it('archives the category (soft delete)', async () => {
    const cat = await seed();
    const req = new Request(`http://x/api/admin/categories/${cat.id}`, {
      method: 'DELETE',
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: cat.id }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deletedAt).not.toBeNull();
  });

  it('403 when not OWNER', async () => {
    const cat = await seed();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'CUSTOMER' } });
    const req = new Request(`http://x/api/admin/categories/${cat.id}`, {
      method: 'DELETE',
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: cat.id }) });
    expect(res.status).toBe(403);
  });
});
