import { z } from "zod";
import { AddressSchema } from "./address";

export const SavedAddressSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  isDefault: z.boolean(),
  address: AddressSchema,
});

export type SavedAddress = z.infer<typeof SavedAddressSchema>;
