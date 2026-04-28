import { NextResponse } from "next/server";
import { z } from "zod";
import { assertCsrf } from "@/server/auth/csrf";
import { requireSessionUser, getSessionUser } from "@/server/auth/session";
import { withTransaction } from "@/server/db/transaction";
import { listAddressesForUser } from "@/server/repositories/address.repo";
import { toSavedAddress } from "@/server/data/adapters/address";

export const dynamic = "force-dynamic";

const AddressBodySchema = z.object({
  label: z.string().min(1).max(60),
  isDefault: z.boolean().default(false),
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).nullable().default(null),
  city: z.string().min(1).max(120),
  postcode: z.string().min(1).max(20),
  country: z.string().length(2),
  phone: z.string().max(40).default(""),
});

export async function GET(): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const rows = await listAddressesForUser(user.id);
  return NextResponse.json({ addresses: rows.map(toSavedAddress) });
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    await assertCsrf();
    const session = await requireSessionUser();
    const body = await req.json().catch(() => null);
    const parsed = AddressBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 422 });
    }
    const created = await withTransaction(async (tx) => {
      if (parsed.data.isDefault) {
        await tx.address.updateMany({
          where: { userId: session.id, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.address.create({
        data: { ...parsed.data, userId: session.id },
      });
    });
    return NextResponse.json({ address: toSavedAddress(created) }, { status: 201 });
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json({ error: e.message ?? "ERROR" }, { status: e.status ?? 500 });
  }
}
