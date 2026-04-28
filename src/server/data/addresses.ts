import type { SavedAddress } from "@/lib/schemas/saved-address";
import { listAddressesForUser } from "@/server/repositories/address.repo";
import { getSessionUser } from "@/server/auth/session";
import { toSavedAddress } from "./adapters/address";

export async function getSavedAddresses(): Promise<SavedAddress[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const rows = await listAddressesForUser(user.id);
  return rows.map(toSavedAddress);
}
