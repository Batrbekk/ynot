import { z } from "zod";
import { AddressSchema } from "../schemas";
import addressesJson from "./_mock/addresses.json";

export const SavedAddressSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  isDefault: z.boolean(),
  address: AddressSchema,
});

export type SavedAddress = z.infer<typeof SavedAddressSchema>;

let cache: SavedAddress[] | null = null;

function load(): SavedAddress[] {
  if (cache) return cache;
  cache = addressesJson.map((a) => SavedAddressSchema.parse(a));
  cache.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  return cache;
}

export async function getSavedAddresses(): Promise<SavedAddress[]> {
  return load();
}
