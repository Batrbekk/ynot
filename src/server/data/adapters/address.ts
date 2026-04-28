import type { SavedAddress } from "@/lib/schemas/saved-address";
import type { Address as PrismaAddress } from "@prisma/client";

export function toSavedAddress(row: PrismaAddress): SavedAddress {
  return {
    id: row.id,
    label: row.label,
    isDefault: row.isDefault,
    address: {
      firstName: row.firstName,
      lastName: row.lastName,
      line1: row.line1,
      line2: row.line2,
      city: row.city,
      postcode: row.postcode,
      country: row.country,
      phone: row.phone,
    },
  };
}
