import { z } from 'zod';

export const ShippingAddress = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  line1: z.string().min(1).max(120),
  line2: z.string().max(120).optional().nullable(),
  city: z.string().min(1).max(60),
  postcode: z.string().min(1).max(20),
  countryCode: z.string().length(2).toUpperCase(),
  phone: z.string().min(5).max(30),
});
export type ShippingAddressT = z.infer<typeof ShippingAddress>;

export const QuoteRequest = z.object({
  address: ShippingAddress,
});
export type QuoteRequestT = z.infer<typeof QuoteRequest>;

export const QuoteResponse = z.object({
  methods: z.array(
    z.object({
      methodId: z.string(),
      name: z.string(),
      carrier: z.enum(['ROYAL_MAIL', 'DHL']),
      baseRateCents: z.number(),
      dutiesCents: z.number(),
      totalCents: z.number(),
      estimatedDaysMin: z.number(),
      estimatedDaysMax: z.number(),
    }),
  ),
});
export type QuoteResponseT = z.infer<typeof QuoteResponse>;

export const CreateOrderRequest = z.object({
  address: ShippingAddress,
  methodId: z.string().min(1),
});
export type CreateOrderRequestT = z.infer<typeof CreateOrderRequest>;

export const CreateOrderResponse = z.object({
  orderId: z.string(),
  clientSecret: z.string(),
});
export type CreateOrderResponseT = z.infer<typeof CreateOrderResponse>;

export const ClaimAccountRequest = z.object({
  orderId: z.string(),
  password: z.string().min(12).max(100),
});
export type ClaimAccountRequestT = z.infer<typeof ClaimAccountRequest>;
