import { prisma } from '@/server/db/client';
import { withAudit } from '../audit';
import type { PromoCreateInput, PromoUpdateInput } from '@/lib/schemas/admin-promo';

export interface CreatePromoOptions {
  input: PromoCreateInput;
  actorId: string;
  ip?: string;
  ua?: string;
}

/**
 * Inserts a new promo. The Zod schema already enforces uppercase + format
 * and the PERCENT≤100 invariant, but we re-check inside the service so a
 * caller bypassing the schema (e.g. seed scripts) can't break the rule.
 *
 * Uniqueness is guarded by `PromoCode.code @unique` — duplicate inserts
 * surface as a Prisma `P2002` error which the API route turns into 409.
 */
export async function createPromo(opts: CreatePromoOptions) {
  const { input, actorId, ip, ua } = opts;
  if (input.discountType === 'PERCENT' && input.discountValue > 100) {
    throw new Error('PERCENT discountValue must be 1..100');
  }
  return withAudit(
    {
      actorId,
      entityType: 'promo',
      entityId: 'pending',
      action: 'promo.create',
      ip,
      ua,
    },
    async () =>
      prisma.promoCode.create({
        data: {
          code: input.code,
          discountType: input.discountType,
          discountValue: input.discountValue,
          minOrderCents: input.minOrderCents ?? 0,
          usageLimit: input.usageLimit ?? null,
          expiresAt: input.expiresAt ?? null,
          isActive: input.isActive ?? true,
        },
      }),
  );
}

export interface UpdatePromoOptions {
  id: string;
  input: PromoUpdateInput;
  actorId: string;
  ip?: string;
  ua?: string;
}

/**
 * Patches editable fields on an existing promo. `code` is *not* in
 * `PromoUpdateInput` so it cannot be changed — historical redemptions
 * reference it by string in audit logs and email receipts.
 *
 * Computes the effective discount type/value (incoming or persisted) so we
 * can re-validate PERCENT≤100 even when only one of the two fields is
 * supplied.
 */
export async function updatePromo(opts: UpdatePromoOptions) {
  const { id, input, actorId, ip, ua } = opts;
  const before = await prisma.promoCode.findUnique({ where: { id } });
  if (!before) throw new Error(`Promo ${id} not found`);

  const effectiveType = input.discountType ?? before.discountType;
  const effectiveValue = input.discountValue ?? before.discountValue;
  if (effectiveType === 'PERCENT' && effectiveValue > 100) {
    throw new Error('PERCENT discountValue must be 1..100');
  }

  return withAudit(
    {
      actorId,
      entityType: 'promo',
      entityId: id,
      action: 'promo.update',
      before,
      ip,
      ua,
    },
    async () =>
      prisma.promoCode.update({
        where: { id },
        data: {
          discountType: input.discountType,
          discountValue: input.discountValue,
          minOrderCents: input.minOrderCents,
          usageLimit: input.usageLimit,
          expiresAt: input.expiresAt,
          isActive: input.isActive,
        },
      }),
  );
}

export interface DeactivatePromoOptions {
  id: string;
  actorId: string;
  ip?: string;
  ua?: string;
}

/**
 * Soft-disables a promo by flipping `isActive=false`. We deliberately do
 * NOT hard-delete because `PromoRedemption` rows still hold the FK; a
 * delete would either cascade-erase usage history (audit problem) or fail
 * with a constraint error (UX problem). `deletedAt` exists on the model
 * but is reserved for true tombstoning by an out-of-band process.
 */
export async function deactivatePromo(opts: DeactivatePromoOptions) {
  const { id, actorId, ip, ua } = opts;
  const before = await prisma.promoCode.findUnique({ where: { id } });
  if (!before) throw new Error(`Promo ${id} not found`);
  return withAudit(
    {
      actorId,
      entityType: 'promo',
      entityId: id,
      action: 'promo.deactivate',
      before,
      ip,
      ua,
    },
    async () => prisma.promoCode.update({ where: { id }, data: { isActive: false } }),
  );
}
