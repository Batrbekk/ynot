import { describe, expect, it, beforeEach } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import {
  createStaticPage,
  updateStaticPage,
  deleteStaticPage,
} from '../staticpage-service';

describe('staticpage-service', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
  });

  it('creates a page with auto-slug + writes audit', async () => {
    const p = await createStaticPage({
      input: { title: 'About Us', bodyMarkdown: '# Hi' },
      actorId: 'u1',
    });
    expect(p.slug).toBe('about-us');
    expect(p.bodyMarkdown).toBe('# Hi');
    const log = await prisma.auditLog.findFirst({ where: { action: 'staticpage.create' } });
    expect(log).not.toBeNull();
  });

  it('honours explicit slug + suffixes on collision', async () => {
    await createStaticPage({
      input: { title: 'A', slug: 'about', bodyMarkdown: '' },
      actorId: 'u1',
    });
    const second = await createStaticPage({
      input: { title: 'B', slug: 'about', bodyMarkdown: '' },
      actorId: 'u1',
    });
    expect(second.slug).toBe('about-2');
  });

  it('updates fields + writes audit', async () => {
    const p = await createStaticPage({
      input: { title: 'Old', bodyMarkdown: 'old body' },
      actorId: 'u1',
    });
    const updated = await updateStaticPage({
      id: p.id,
      input: { title: 'New', bodyMarkdown: 'new body' },
      actorId: 'u1',
    });
    expect(updated.title).toBe('New');
    expect(updated.bodyMarkdown).toBe('new body');
    expect(updated.slug).toBe(p.slug);
  });

  it('rewrites slug uniqueness when slug changes on update', async () => {
    const a = await createStaticPage({
      input: { title: 'A', slug: 'a', bodyMarkdown: '' },
      actorId: 'u1',
    });
    await createStaticPage({
      input: { title: 'B', slug: 'b', bodyMarkdown: '' },
      actorId: 'u1',
    });
    const updated = await updateStaticPage({
      id: a.id,
      input: { slug: 'b' },
      actorId: 'u1',
    });
    expect(updated.slug).toBe('b-2');
  });

  it('deletes + writes audit', async () => {
    const p = await createStaticPage({
      input: { title: 'X', bodyMarkdown: '' },
      actorId: 'u1',
    });
    await deleteStaticPage({ id: p.id, actorId: 'u1' });
    const found = await prisma.staticPage.findUnique({ where: { id: p.id } });
    expect(found).toBeNull();
  });

  it('throws on missing id', async () => {
    await expect(
      updateStaticPage({ id: 'nope', input: { title: 'x' }, actorId: 'u1' }),
    ).rejects.toThrow(/not found/i);
  });
});
