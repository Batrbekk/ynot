import { z } from "zod";
import { SizeSchema } from "./product";

export const CartItemSchema = z.object({
  productId: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  image: z.string(),
  colour: z.string(),
  size: SizeSchema,
  unitPrice: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
  preOrder: z.boolean(),
});

export type CartItem = z.infer<typeof CartItemSchema>;

export const CartSchema = z.object({
  items: z.array(CartItemSchema),
  promoCode: z.string().nullable(),
  currency: z.literal("GBP"),
});

export type Cart = z.infer<typeof CartSchema>;
