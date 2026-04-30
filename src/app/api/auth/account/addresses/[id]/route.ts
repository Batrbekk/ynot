import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/client";
import { assertCsrf } from "@/server/auth/csrf";
import { requireSessionUser } from "@/server/auth/session";
import { withTransaction } from "@/server/db/transaction";
import { toSavedAddress } from "@/server/data/adapters/address";

export const dynamic = "force-dynamic";

const PatchBodySchema = z.object({
  label: z.string().min(1).max(60).optional(),
  isDefault: z.boolean().optional(),
  firstName: z.string().min(1).max(120).optional(),
  lastName: z.string().min(1).max(120).optional(),
  line1: z.string().min(1).max(200).optional(),
  line2: z.string().max(200).nullable().optional(),
  city: z.string().min(1).max(120).optional(),
  postcode: z.string().min(1).max(20).optional(),
  country: z.string().length(2).optional(),
  phone: z.string().max(40).optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function loadOwnedAddress(addressId: string, userId: string) {
  return prisma.address.findFirst({
    where: { id: addressId, userId },
  });
}

export async function PATCH(req: Request, ctx: RouteContext): Promise<NextResponse> {
  try {
    await assertCsrf();
    const session = await requireSessionUser();
    const { id } = await ctx.params;
    const owned = await loadOwnedAddress(id, session.id);
    if (!owned) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    const body = await req.json().catch(() => null);
    const parsed = PatchBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 422 });
    }
    const updated = await withTransaction(async (tx) => {
      if (parsed.data.isDefault) {
        await tx.address.updateMany({
          where: { userId: session.id, isDefault: true, NOT: { id } },
          data: { isDefault: false },
        });
      }
      return tx.address.update({ where: { id }, data: parsed.data });
    });
    return NextResponse.json({ address: toSavedAddress(updated) });
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json({ error: e.message ?? "ERROR" }, { status: e.status ?? 500 });
  }
}

export async function DELETE(_req: Request, ctx: RouteContext): Promise<NextResponse> {
  try {
    await assertCsrf();
    const session = await requireSessionUser();
    const { id } = await ctx.params;
    const owned = await loadOwnedAddress(id, session.id);
    if (!owned) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    await prisma.address.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json({ error: e.message ?? "ERROR" }, { status: e.status ?? 500 });
  }
}
