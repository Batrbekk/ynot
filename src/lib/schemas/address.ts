import { z } from "zod";

export const AddressSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().nullable(),
  city: z.string().min(1),
  postcode: z.string().min(1),
  /** ISO 3166-1 alpha-2 country code */
  country: z.string().length(2),
  phone: z.string(),
});

export type Address = z.infer<typeof AddressSchema>;
