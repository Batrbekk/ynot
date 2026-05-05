import { describe, expect, it, beforeEach } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import {
  createCategory,
  updateCategory,
  archiveCategory,
  moveCategory,
} from '../category-service';

describe('createCategory', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
  });

  it('creates a category with auto-slug + writes audit row', async () => {
    const cat = await createCategory({
      input: { name: 'Outerwear', description: '' },
      actorId: 'u1',
    });
    expect(cat.slug).toBe('outerwear');
    expect(cat.parentId).toBeNull();

    const log = await prisma.auditLog.findFirst({
      where: { entityType: 'category', action: 'category.create' },
    });
    expect(log).not.toBeNull();
    expect((log!.after as { id: string }).id).toBe(cat.id);
  });

  it('honours an explicit slug + suffixes on collision', async () => {
    await createCategory({
      input: { name: 'A', slug: 'cats', description: '' },
      actorId: 'u1',
    });
    const second = await createCategory({
      input: { name: 'B', slug: 'cats', description: '' },
      actorId: 'u1',
    });
    expect(second.slug).toBe('cats-2');
  });

  it('respects explicit parentId', async () => {
    const parent = await createCategory({
      input: { name: 'Parent', description: '' },
      actorId: 'u1',
    });
    const child = await createCategory({
      input: { name: 'Child', parentId: parent.id, description: '' },
      actorId: 'u1',
    });
    expect(child.parentId).toBe(parent.id);
  });
});

describe('updateCategory', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
  });

  it('updates fields + writes before/after audit row', async () => {
    const created = await createCategory({
      input: { name: 'Old', description: '' },
      actorId: 'u1',
    });
    const updated = await updateCategory({
      id: created.id,
      input: { name: 'New', description: 'pretty' },
      actorId: 'u1',
    });
    expect(updated.name).toBe('New');
    expect(updated.description).toBe('pretty');
    expect(updated.slug).toBe('old');

    const log = await prisma.auditLog.findFirst({ where: { action: 'category.update' } });
    expect(log).not.toBeNull();
    expect((log!.before as { name: string }).name).toBe('Old');
    expect((log!.after as { name: string }).name).toBe('New');
  });

  it('reroutes parentId change through cycle check (rejects self-parent)', async () => {
    const a = await createCategory({
      input: { name: 'A', description: '' },
      actorId: 'u1',
    });
    await expect(
      updateCategory({ id: a.id, input: { parentId: a.id }, actorId: 'u1' }),
    ).rejects.toThrow(/cycle/i);
  });

  it('reroutes parentId change through cycle check (rejects descendant-parent)', async () => {
    const a = await createCategory({
      input: { name: 'A', description: '' },
      actorId: 'u1',
    });
    const b = await createCategory({
      input: { name: 'B', parentId: a.id, description: '' },
      actorId: 'u1',
    });
    // Setting A's parent to B would create A → B → A cycle.
    await expect(
      updateCategory({ id: a.id, input: { parentId: b.id }, actorId: 'u1' }),
    ).rejects.toThrow(/cycle/i);
  });
});

describe('archiveCategory', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
  });

  it('sets deletedAt + writes audit', async () => {
    const cat = await createCategory({
      input: { name: 'Doomed', description: '' },
      actorId: 'u1',
    });
    const archived = await archiveCategory({ id: cat.id, actorId: 'u1' });
    expect(archived.deletedAt).not.toBeNull();
    const log = await prisma.auditLog.findFirst({ where: { action: 'category.archive' } });
    expect(log).not.toBeNull();
  });
});

describe('moveCategory', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
  });

  it('moves to a new parent + writes audit', async () => {
    const a = await createCategory({
      input: { name: 'A', description: '' },
      actorId: 'u1',
    });
    const b = await createCategory({
      input: { name: 'B', description: '' },
      actorId: 'u1',
    });
    const moved = await moveCategory({ id: b.id, parentId: a.id, actorId: 'u1' });
    expect(moved.parentId).toBe(a.id);
    const log = await prisma.auditLog.findFirst({ where: { action: 'category.move' } });
    expect(log).not.toBeNull();
  });

  it('moves to root (parentId=null) is allowed', async () => {
    const a = await createCategory({
      input: { name: 'A', description: '' },
      actorId: 'u1',
    });
    const b = await createCategory({
      input: { name: 'B', parentId: a.id, description: '' },
      actorId: 'u1',
    });
    const moved = await moveCategory({ id: b.id, parentId: null, actorId: 'u1' });
    expect(moved.parentId).toBeNull();
  });

  it('rejects setting self as parent (cycle)', async () => {
    const a = await createCategory({
      input: { name: 'A', description: '' },
      actorId: 'u1',
    });
    await expect(
      moveCategory({ id: a.id, parentId: a.id, actorId: 'u1' }),
    ).rejects.toThrow(/cycle/i);
  });

  it('rejects setting descendant as parent (cycle)', async () => {
    const a = await createCategory({
      input: { name: 'A', description: '' },
      actorId: 'u1',
    });
    const b = await createCategory({
      input: { name: 'B', parentId: a.id, description: '' },
      actorId: 'u1',
    });
    const c = await createCategory({
      input: { name: 'C', parentId: b.id, description: '' },
      actorId: 'u1',
    });
    // A → B → C; setting A's parent to C would close A → C → B → A.
    await expect(
      moveCategory({ id: a.id, parentId: c.id, actorId: 'u1' }),
    ).rejects.toThrow(/cycle/i);
  });

  it('survives a corrupt cycle in existing data without infinite-looping', async () => {
    // Construct A → B → A in raw SQL so the walker has something to break on.
    const a = await prisma.category.create({
      data: { slug: 'a', name: 'A' },
    });
    const b = await prisma.category.create({
      data: { slug: 'b', name: 'B', parentId: a.id },
    });
    await prisma.category.update({ where: { id: a.id }, data: { parentId: b.id } });
    // Now trying to move some unrelated node onto C-which-is-actually-cycled
    // should still terminate (and resolve as not-a-cycle for an unrelated id).
    const z = await createCategory({
      input: { name: 'Z', description: '' },
      actorId: 'u1',
    });
    await expect(
      moveCategory({ id: z.id, parentId: a.id, actorId: 'u1' }),
    ).resolves.toMatchObject({ parentId: a.id });
  });
});
