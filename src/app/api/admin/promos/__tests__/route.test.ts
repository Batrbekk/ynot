import { describe, expect, it, beforeEach, vi } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';

vi.mock('@/server/auth/nextauth', () => ({ auth: vi.fn() }));
import { auth } from '@/server/auth/nextauth';
import { POST } from '../route';
import { PATCH } from '../[id]/route';
import { POST as DEACTIVATE } from '../[id]/deactivate/route';

const promoBody = {
  code: 'WELCOME10',
  discountType: 'PERCENT',
  discountValue: 10,
  minOrderCents: 0,
  isActive: true,
};

describe('promo endpoints', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'OWNER' } });
  });

  it('POST 403 when not OWNER', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'CUSTOMER' } });
    const req = new Request('http://x/api/admin/promos', {
      method: 'POST',
      body: JSON.stringify(promoBody),
    });
    expect((await POST(req)).status).toBe(403);
  });

  it('POST 400 on invalid body (lowercase code)', async () => {
    const req = new Request('http://x/api/admin/promos', {
      method: 'POST',
      body: JSON.stringify({ ...promoBody, code: 'welcome10' }),
    });
    expect((await POST(req)).status).toBe(400);
  });

  it('POST 400 on PERCENT > 100', async () => {
    const req = new Request('http://x/api/admin/promos', {
      method: 'POST',
      body: JSON.stringify({ ...promoBody, discountValue: 200 }),
    });
    expect((await POST(req)).status).toBe(400);
  });

  it('POST 201 creates promo', async () => {
    const req = new Request('http://x/api/admin/promos', {
      method: 'POST',
      body: JSON.stringify(promoBody),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.code).toBe('WELCOME10');
    expect(data.discountValue).toBe(10);
  });

  it('POST 409 on duplicate code', async () => {
    await prisma.promoCode.create({
      data: { code: 'DUPE', discountType: 'FIXED', discountValue: 500 },
    });
    const req = new Request('http://x/api/admin/promos', {
      method: 'POST',
      body: JSON.stringify({ ...promoBody, code: 'DUPE' }),
    });
    expect((await POST(req)).status).toBe(409);
  });

  it('PATCH updates discountValue', async () => {
    const created = await prisma.promoCode.create({
      data: { code: 'EDIT', discountType: 'PERCENT', discountValue: 10 },
    });
    const req = new Request(`http://x/api/admin/promos/${created.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ discountValue: 25 }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: created.id }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.discountValue).toBe(25);
  });

  it('PATCH 404 on missing promo', async () => {
    const req = new Request('http://x/api/admin/promos/nope', {
      method: 'PATCH',
      body: JSON.stringify({ discountValue: 5 }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'nope' }) });
    expect(res.status).toBe(404);
  });

  it('PATCH ignores `code` field silently (schema strips it)', async () => {
    const created = await prisma.promoCode.create({
      data: { code: 'KEEP', discountType: 'FIXED', discountValue: 500 },
    });
    const req = new Request(`http://x/api/admin/promos/${created.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ code: 'CHANGED', discountValue: 700 }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: created.id }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.code).toBe('KEEP');
    expect(data.discountValue).toBe(700);
  });

  it('POST /deactivate sets isActive=false', async () => {
    const created = await prisma.promoCode.create({
      data: { code: 'KILL', discountType: 'FIXED', discountValue: 500, isActive: true },
    });
    const req = new Request(`http://x/api/admin/promos/${created.id}/deactivate`, {
      method: 'POST',
    });
    const res = await DEACTIVATE(req, { params: Promise.resolve({ id: created.id }) });
    expect(res.status).toBe(200);
    const after = await prisma.promoCode.findUnique({ where: { id: created.id } });
    expect(after!.isActive).toBe(false);
  });

  it('POST /deactivate 404 on missing', async () => {
    const req = new Request('http://x/api/admin/promos/nope/deactivate', { method: 'POST' });
    const res = await DEACTIVATE(req, { params: Promise.resolve({ id: 'nope' }) });
    expect(res.status).toBe(404);
  });
});
