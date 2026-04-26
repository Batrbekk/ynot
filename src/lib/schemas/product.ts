import { z } from "zod";

export const SizeSchema = z.enum(["XS", "S", "M", "L", "XL"]);
export type Size = z.infer<typeof SizeSchema>;

export const ProductDetailsSchema = z.object({
  materials: z.string(),
  care: z.string(),
  sizing: z.string(),
});

export const ProductSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  /** Price in minor units (pence for GBP). 89500 = £895.00 */
  price: z.number().int().nonnegative(),
  currency: z.literal("GBP"),
  description: z.string(),
  images: z.array(z.string()),
  colour: z.string().optional(),
  sizes: z.array(SizeSchema),
  categorySlugs: z.array(z.string()),
  stock: z.record(SizeSchema, z.number().int().nonnegative()),
  preOrder: z.boolean(),
  details: ProductDetailsSchema,
});

export type Product = z.infer<typeof ProductSchema>;
