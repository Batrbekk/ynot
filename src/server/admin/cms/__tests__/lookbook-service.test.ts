import { describe, expect, it, beforeEach } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import {
  createLookbook,
  updateLookbook,
  reorderLookbook,
  deleteLookbook,
} from '../lookbook-service';

describe('lookbook-service', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
  });

  it('creates an image at the end of the sortOrder + writes audit', async () => {
    const a = await createLookbook({
      input: { src: 'https://x/a.jpg', alt: 'A' },
      actorId: 'u1',
    });
    const b = await createLookbook({
      input: { src: 'https://x/b.jpg', alt: 'B' },
      actorId: 'u1',
    });
    expect(a.sortOrder).toBe(0);
    expect(b.sortOrder).toBe(1);
    const log = await prisma.auditLog.findFirst({ where: { action: 'lookbook.create' } });
    expect(log).not.toBeNull();
  });

  it('updates fields + writes audit', async () => {
    const a = await createLookbook({
      input: { src: 'https://x/a.jpg', alt: 'A' },
      actorId: 'u1',
    });
    const updated = await updateLookbook({
      id: a.id,
      input: { alt: 'A2', productSlug: 'spring-coat' },
      actorId: 'u1',
    });
    expect(updated.alt).toBe('A2');
    expect(updated.productSlug).toBe('spring-coat');
  });

  it('reorders by id sequence + writes audit', async () => {
    const a = await createLookbook({ input: { src: 'https://x/a.jpg', alt: '' }, actorId: 'u1' });
    const b = await createLookbook({ input: { src: 'https://x/b.jpg', alt: '' }, actorId: 'u1' });
    const c = await createLookbook({ input: { src: 'https://x/c.jpg', alt: '' }, actorId: 'u1' });
    const result = await reorderLookbook({
      order: [c.id, a.id, b.id],
      actorId: 'u1',
    });
    expect(result.map((r) => r.id)).toEqual([c.id, a.id, b.id]);
    expect(result[0].sortOrder).toBe(0);
    expect(result[2].sortOrder).toBe(2);
    const log = await prisma.auditLog.findFirst({ where: { action: 'lookbook.reorder' } });
    expect(log).not.toBeNull();
  });

  it('deletes + writes audit', async () => {
    const a = await createLookbook({
      input: { src: 'https://x/a.jpg', alt: 'A' },
      actorId: 'u1',
    });
    await deleteLookbook({ id: a.id, actorId: 'u1' });
    const found = await prisma.lookbookImage.findUnique({ where: { id: a.id } });
    expect(found).toBeNull();
  });

  it('throws on missing id', async () => {
    await expect(
      updateLookbook({ id: 'nope', input: { alt: 'x' }, actorId: 'u1' }),
    ).rejects.toThrow(/not found/i);
  });
});
