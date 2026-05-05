import { prisma } from '@/server/db/client';
import { withAudit } from '../audit';
import type {
  LookbookCreateInput,
  LookbookUpdateInput,
} from '@/lib/schemas/admin-lookbook';

export interface CreateLookbookOptions {
  input: LookbookCreateInput;
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function createLookbook(opts: CreateLookbookOptions) {
  const { input, actorId, ip, ua } = opts;
  return withAudit(
    {
      actorId,
      entityType: 'lookbook',
      entityId: 'pending',
      action: 'lookbook.create',
      ip,
      ua,
    },
    async () => {
      const max = await prisma.lookbookImage.aggregate({ _max: { sortOrder: true } });
      const next =
        max._max.sortOrder !== null && max._max.sortOrder !== undefined
          ? max._max.sortOrder + 1
          : 0;
      return prisma.lookbookImage.create({
        data: {
          src: input.src,
          alt: input.alt ?? '',
          productSlug: input.productSlug ?? null,
          sortOrder: next,
        },
      });
    },
  );
}

export interface UpdateLookbookOptions {
  id: string;
  input: LookbookUpdateInput;
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function updateLookbook(opts: UpdateLookbookOptions) {
  const { id, input, actorId, ip, ua } = opts;
  const before = await prisma.lookbookImage.findUnique({ where: { id } });
  if (!before) throw new Error(`Lookbook ${id} not found`);
  return withAudit(
    { actorId, entityType: 'lookbook', entityId: id, action: 'lookbook.update', before, ip, ua },
    async () =>
      prisma.lookbookImage.update({
        where: { id },
        data: {
          src: input.src,
          alt: input.alt,
          productSlug: input.productSlug,
        },
      }),
  );
}

export interface ReorderLookbookOptions {
  order: string[];
  actorId: string;
  ip?: string;
  ua?: string;
}

/**
 * Sets `sortOrder` on each row to its index in the `order` array. Mirrors
 * the productImage reorder pattern — a transactional sequence of updates so
 * a partial failure rolls back. Returns the new ordered list.
 */
export async function reorderLookbook(opts: ReorderLookbookOptions) {
  const { order, actorId, ip, ua } = opts;
  return withAudit(
    {
      actorId,
      entityType: 'lookbook',
      entityId: 'reorder',
      action: 'lookbook.reorder',
      ip,
      ua,
    },
    async () =>
      prisma.$transaction(async (tx) => {
        for (let i = 0; i < order.length; i++) {
          await tx.lookbookImage.update({
            where: { id: order[i] },
            data: { sortOrder: i },
          });
        }
        return tx.lookbookImage.findMany({ orderBy: { sortOrder: 'asc' } });
      }),
  );
}

export interface DeleteLookbookOptions {
  id: string;
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function deleteLookbook(opts: DeleteLookbookOptions) {
  const { id, actorId, ip, ua } = opts;
  const before = await prisma.lookbookImage.findUnique({ where: { id } });
  if (!before) throw new Error(`Lookbook ${id} not found`);
  return withAudit(
    { actorId, entityType: 'lookbook', entityId: id, action: 'lookbook.delete', before, ip, ua },
    async () => prisma.lookbookImage.delete({ where: { id } }),
  );
}
