import { describe, expect, it, beforeEach } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import {
  createHero,
  updateHero,
  activateHero,
  deleteHero,
} from '../hero-service';

describe('createHero', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
  });

  it('creates a hero with isActive=false even when callers might wish otherwise', async () => {
    const hero = await createHero({
      input: {
        kind: 'IMAGE',
        imageUrl: 'https://example.com/x.jpg',
        eyebrow: 'New season',
        ctaLabel: 'Shop now',
        ctaHref: '/collections/all',
      },
      actorId: 'u1',
    });
    expect(hero.isActive).toBe(false);
    const log = await prisma.auditLog.findFirst({
      where: { entityType: 'hero', action: 'hero.create' },
    });
    expect(log).not.toBeNull();
    expect((log!.after as { id: string }).id).toBe(hero.id);
  });
});

describe('updateHero', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
  });

  it('updates fields without touching isActive', async () => {
    const created = await createHero({
      input: {
        kind: 'IMAGE',
        imageUrl: 'https://example.com/x.jpg',
        eyebrow: 'A',
        ctaLabel: 'Shop',
        ctaHref: '/x',
      },
      actorId: 'u1',
    });
    // Promote it so we can ensure update doesn't flip it back.
    await activateHero({ id: created.id, actorId: 'u1' });
    const updated = await updateHero({
      id: created.id,
      input: { eyebrow: 'B', ctaLabel: 'Visit' },
      actorId: 'u1',
    });
    expect(updated.eyebrow).toBe('B');
    expect(updated.ctaLabel).toBe('Visit');
    expect(updated.isActive).toBe(true);
    const log = await prisma.auditLog.findFirst({ where: { action: 'hero.update' } });
    expect(log).not.toBeNull();
  });

  it('throws when id missing', async () => {
    await expect(
      updateHero({ id: 'nope', input: { eyebrow: 'x' }, actorId: 'u1' }),
    ).rejects.toThrow(/not found/i);
  });
});

describe('activateHero', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
  });

  it('flips the only-one-active invariant — deactivates others', async () => {
    const a = await createHero({
      input: { kind: 'IMAGE', imageUrl: 'https://x/a.jpg', eyebrow: 'a', ctaLabel: 'a', ctaHref: '/a' },
      actorId: 'u1',
    });
    const b = await createHero({
      input: { kind: 'IMAGE', imageUrl: 'https://x/b.jpg', eyebrow: 'b', ctaLabel: 'b', ctaHref: '/b' },
      actorId: 'u1',
    });
    await activateHero({ id: a.id, actorId: 'u1' });
    const aAfter1 = await prisma.heroBlock.findUnique({ where: { id: a.id } });
    expect(aAfter1!.isActive).toBe(true);

    await activateHero({ id: b.id, actorId: 'u1' });
    const aAfter2 = await prisma.heroBlock.findUnique({ where: { id: a.id } });
    const bAfter2 = await prisma.heroBlock.findUnique({ where: { id: b.id } });
    expect(aAfter2!.isActive).toBe(false);
    expect(bAfter2!.isActive).toBe(true);
  });

  it('is idempotent — activating an already-active hero is a no-op', async () => {
    const a = await createHero({
      input: { kind: 'IMAGE', imageUrl: 'https://x/a.jpg', eyebrow: 'a', ctaLabel: 'a', ctaHref: '/a' },
      actorId: 'u1',
    });
    await activateHero({ id: a.id, actorId: 'u1' });
    const auditBefore = await prisma.auditLog.count({ where: { action: 'hero.activate' } });
    const result = await activateHero({ id: a.id, actorId: 'u1' });
    expect(result.isActive).toBe(true);
    const auditAfter = await prisma.auditLog.count({ where: { action: 'hero.activate' } });
    expect(auditAfter).toBe(auditBefore);
  });

  it('throws when id missing', async () => {
    await expect(activateHero({ id: 'nope', actorId: 'u1' })).rejects.toThrow(/not found/i);
  });
});

describe('deleteHero', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
  });

  it('deletes hero + writes audit', async () => {
    const a = await createHero({
      input: { kind: 'IMAGE', imageUrl: 'https://x/a.jpg', eyebrow: 'a', ctaLabel: 'a', ctaHref: '/a' },
      actorId: 'u1',
    });
    await deleteHero({ id: a.id, actorId: 'u1' });
    const found = await prisma.heroBlock.findUnique({ where: { id: a.id } });
    expect(found).toBeNull();
    const log = await prisma.auditLog.findFirst({ where: { action: 'hero.delete' } });
    expect(log).not.toBeNull();
  });
});
