import { prisma } from '@/server/db/client';
import { withAudit } from '../audit';
import type {
  AnnouncementCreateInput,
  AnnouncementUpdateInput,
} from '@/lib/schemas/admin-announcement';

export interface CreateAnnouncementOptions {
  input: AnnouncementCreateInput;
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function createAnnouncement(opts: CreateAnnouncementOptions) {
  const { input, actorId, ip, ua } = opts;
  return withAudit(
    {
      actorId,
      entityType: 'announcement',
      entityId: 'pending',
      action: 'announcement.create',
      ip,
      ua,
    },
    async () =>
      prisma.announcementMessage.create({
        data: {
          text: input.text,
          sortOrder: input.sortOrder,
          isActive: input.isActive,
        },
      }),
  );
}

export interface UpdateAnnouncementOptions {
  id: string;
  input: AnnouncementUpdateInput;
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function updateAnnouncement(opts: UpdateAnnouncementOptions) {
  const { id, input, actorId, ip, ua } = opts;
  const before = await prisma.announcementMessage.findUnique({ where: { id } });
  if (!before) throw new Error(`Announcement ${id} not found`);
  return withAudit(
    {
      actorId,
      entityType: 'announcement',
      entityId: id,
      action: 'announcement.update',
      before,
      ip,
      ua,
    },
    async () =>
      prisma.announcementMessage.update({
        where: { id },
        data: {
          text: input.text,
          sortOrder: input.sortOrder,
          isActive: input.isActive,
        },
      }),
  );
}

export interface DeleteAnnouncementOptions {
  id: string;
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function deleteAnnouncement(opts: DeleteAnnouncementOptions) {
  const { id, actorId, ip, ua } = opts;
  const before = await prisma.announcementMessage.findUnique({ where: { id } });
  if (!before) throw new Error(`Announcement ${id} not found`);
  return withAudit(
    {
      actorId,
      entityType: 'announcement',
      entityId: id,
      action: 'announcement.delete',
      before,
      ip,
      ua,
    },
    async () => prisma.announcementMessage.delete({ where: { id } }),
  );
}
