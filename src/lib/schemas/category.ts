import { z } from "zod";

export const SeoMetaSchema = z.object({
  title: z.string(),
  description: z.string(),
});

export const CategorySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  bannerImage: z.string().nullable(),
  sortOrder: z.number().int(),
  meta: SeoMetaSchema,
});

export type Category = z.infer<typeof CategorySchema>;
