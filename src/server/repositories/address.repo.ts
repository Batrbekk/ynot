import type { Address } from "@prisma/client";
import { prisma } from "../db/client";

export async function listAddressesForUser(userId: string): Promise<Address[]> {
  return prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}
