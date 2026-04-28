import type { SavedAddress } from "@/lib/schemas/saved-address";
import { prisma } from "@/server/db/client";
import { listAddressesForUser } from "@/server/repositories/address.repo";
import { toSavedAddress } from "./adapters/address";

// PHASE 3: replace with await getSessionUser() once NextAuth is wired up.
const STUB_USER_EMAIL = "demo@ynot.london";

export async function getSavedAddresses(): Promise<SavedAddress[]> {
  const user = await prisma.user.findUnique({
    where: { email: STUB_USER_EMAIL },
  });
  if (!user) return [];
  const rows = await listAddressesForUser(user.id);
  return rows.map(toSavedAddress);
}
