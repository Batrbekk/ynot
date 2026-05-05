import { describe, expect, it, beforeEach, vi } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';

vi.mock('@/server/auth/nextauth', () => ({ auth: vi.fn() }));

import { auth } from '@/server/auth/nextauth';
import { POST } from '../route';

describe('POST /api/admin/products', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'OWNER' } });
  });

  it('403 when not OWNER', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'CUSTOMER' } });
    const req = new Request('http://x/api/admin/products', {
      method: 'POST',
      body: JSON.stringify({ name: 'X', description: 'd', priceCents: 1 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('400 on invalid body', async () => {
    const req = new Request('http://x/api/admin/products', {
      method: 'POST',
      body: JSON.stringify({ name: '' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('201 on success — returns DRAFT product with auto-slug', async () => {
    const req = new Request('http://x/api/admin/products', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Spring Coat',
        description: 'A trench.',
        priceCents: 45000,
        materials: '',
        care: '',
        sizing: '',
        preOrder: false,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.status).toBe('DRAFT');
    expect(data.slug).toBe('spring-coat');
  });
});
