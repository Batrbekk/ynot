import { z } from 'zod';

/**
 * Admin lookbook image schemas. The lookbook is an ordered grid of editorial
 * images, each optionally linking to a product detail page.
 */
export const LookbookCreateSchema = z.object({
  src: z.string().url(),
  alt: z.string().max(200).default(''),
  productSlug: z.string().min(1).max(200).nullable().optional(),
});

export const LookbookUpdateSchema = LookbookCreateSchema.partial();

export const LookbookReorderSchema = z.object({
  order: z.array(z.string().min(1)).min(1),
});

export type LookbookCreateInput = z.infer<typeof LookbookCreateSchema>;
export type LookbookUpdateInput = z.infer<typeof LookbookUpdateSchema>;
export type LookbookReorderInput = z.infer<typeof LookbookReorderSchema>;
