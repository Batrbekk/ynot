import { describe, expect, it, beforeEach } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import {
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '../announcement-service';

describe('announcement-service', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
  });

  it('creates an announcement + writes audit', async () => {
    const a = await createAnnouncement({
      input: { text: 'Free UK shipping', sortOrder: 0, isActive: true },
      actorId: 'u1',
    });
    expect(a.text).toBe('Free UK shipping');
    expect(a.isActive).toBe(true);
    const log = await prisma.auditLog.findFirst({ where: { action: 'announcement.create' } });
    expect(log).not.toBeNull();
  });

  it('updates fields + writes before/after audit', async () => {
    const a = await createAnnouncement({
      input: { text: 'Old', sortOrder: 0, isActive: true },
      actorId: 'u1',
    });
    const updated = await updateAnnouncement({
      id: a.id,
      input: { text: 'New', isActive: false },
      actorId: 'u1',
    });
    expect(updated.text).toBe('New');
    expect(updated.isActive).toBe(false);
    const log = await prisma.auditLog.findFirst({ where: { action: 'announcement.update' } });
    expect(log).not.toBeNull();
    expect((log!.before as { text: string }).text).toBe('Old');
  });

  it('deletes + writes audit', async () => {
    const a = await createAnnouncement({
      input: { text: 'X', sortOrder: 0, isActive: true },
      actorId: 'u1',
    });
    await deleteAnnouncement({ id: a.id, actorId: 'u1' });
    const found = await prisma.announcementMessage.findUnique({ where: { id: a.id } });
    expect(found).toBeNull();
    const log = await prisma.auditLog.findFirst({ where: { action: 'announcement.delete' } });
    expect(log).not.toBeNull();
  });

  it('throws on missing id', async () => {
    await expect(
      updateAnnouncement({ id: 'nope', input: { text: 'x' }, actorId: 'u1' }),
    ).rejects.toThrow(/not found/i);
  });
});
