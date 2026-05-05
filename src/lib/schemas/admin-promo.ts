import { z } from 'zod';

/**
 * Admin promo code schemas. The PromoCode model represents a discount that
 * customers may apply at checkout. Two discount kinds:
 *  - FIXED: `discountValue` is in pence (e.g. 500 → £5 off).
 *  - PERCENT: `discountValue` is the percentage 1..100.
 *
 * `code` is normalised to uppercase A-Z, digits, `_`, `-` so links and copy
 * remain unambiguous; we error on lowercase rather than silently uppercasing
 * so the operator sees exactly what they typed.
 *
 * `code` is read-only after create — see `PromoUpdateSchema`. This avoids
 * orphaning historical `PromoRedemption` rows that reference the old code on
 * receipts/emails.
 */
export const PromoCreateSchema = z
  .object({
    code: z
      .string()
      .min(3)
      .max(30)
      .regex(/^[A-Z0-9_-]+$/, 'Use uppercase A-Z, 0-9, _, -'),
    discountType: z.enum(['FIXED', 'PERCENT']),
    discountValue: z.number().int().positive(),
    minOrderCents: z.number().int().min(0).default(0),
    usageLimit: z.number().int().positive().optional(),
    expiresAt: z.coerce.date().optional(),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.discountType === 'PERCENT' && data.discountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discountValue'],
        message: 'PERCENT discountValue must be 1..100',
      });
    }
  });

/**
 * Update schema. `code` is intentionally absent — we forbid editing the
 * customer-facing code so existing redemptions still match. To rotate a
 * code, deactivate the old row and create a new one.
 */
export const PromoUpdateSchema = z
  .object({
    discountType: z.enum(['FIXED', 'PERCENT']).optional(),
    discountValue: z.number().int().positive().optional(),
    minOrderCents: z.number().int().min(0).optional(),
    usageLimit: z.number().int().positive().nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.discountType === 'PERCENT' &&
      data.discountValue !== undefined &&
      data.discountValue > 100
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discountValue'],
        message: 'PERCENT discountValue must be 1..100',
      });
    }
  });

export type PromoCreateInput = z.infer<typeof PromoCreateSchema>;
export type PromoUpdateInput = z.infer<typeof PromoUpdateSchema>;
