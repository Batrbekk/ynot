import { z } from 'zod';

/**
 * Admin static page schemas (about, contact, FAQ, terms…). The body is
 * stored as Markdown which the storefront renders with `react-markdown` +
 * `remark-gfm`.
 */
export const StaticPageCreateSchema = z.object({
  slug: z.string().min(1).max(200).optional(),
  title: z.string().min(1).max(200),
  bodyMarkdown: z.string().max(100_000).default(''),
  metaTitle: z.string().max(200).default(''),
  metaDescription: z.string().max(500).default(''),
});

export const StaticPageUpdateSchema = StaticPageCreateSchema.partial();

export type StaticPageCreateInput = z.infer<typeof StaticPageCreateSchema>;
export type StaticPageUpdateInput = z.infer<typeof StaticPageUpdateSchema>;
