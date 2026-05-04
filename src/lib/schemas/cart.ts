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
  /**
   * When this item came from a server Order (vs a transient cart preview),
   * the prisma OrderItem.id — needed by the returns wizard so it can post
   * `{ orderItemId, quantity }` payloads to POST /api/returns.
   */
  orderItemId: z.string().optional(),
});

export type CartItem = z.infer<typeof CartItemSchema>;

export const CartSchema = z.object({
  items: z.array(CartItemSchema),
  promoCode: z.string().nullable(),
  currency: z.literal("GBP"),
});

export type Cart = z.infer<typeof CartSchema>;

// ---- Phase 4: server-driven cart API schemas ----

export const AddItemRequest = z.object({
  productId: z.string().min(1),
  size: SizeSchema,
  colour: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
  isPreorder: z.boolean().default(false),
});

export const SetQuantityRequest = z.object({
  quantity: z.number().int().min(0).max(20),
});

export const ApplyPromoRequest = z.object({
  code: z.string().trim().toUpperCase().min(1).max(40),
});

export type AddItemRequestT = z.infer<typeof AddItemRequest>;
export type SetQuantityRequestT = z.infer<typeof SetQuantityRequest>;
export type ApplyPromoRequestT = z.infer<typeof ApplyPromoRequest>;

export const CartItemSnapshot = z.object({
  id: z.string(),
  productId: z.string(),
  productSlug: z.string(),
  productName: z.string(),
  productImage: z.string(),
  colour: z.string(),
  size: SizeSchema,
  quantity: z.number(),
  unitPriceCents: z.number(),
  currency: z.literal('GBP'),
  isPreorder: z.boolean(),
  preorderBatchId: z.string().nullable(),
  stockAvailable: z.number(),
});

export const CartSnapshot = z.object({
  id: z.string(),
  items: z.array(CartItemSnapshot),
  subtotalCents: z.number(),
  discountCents: z.number(),
  promo: z.object({ code: z.string(), discountCents: z.number() }).nullable(),
  itemCount: z.number(),
  expiresAt: z.string(), // ISO 8601
});

export type CartItemSnapshotT = z.infer<typeof CartItemSnapshot>;
export type CartSnapshotT = z.infer<typeof CartSnapshot>;
