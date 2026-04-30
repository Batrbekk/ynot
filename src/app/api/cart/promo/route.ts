import { NextResponse } from 'next/server';
import { resolveCart } from '@/server/cart/resolve';
import { applyPromo, removePromo, PromoApplyError } from '@/server/cart/service';
import { ApplyPromoRequest } from '@/lib/schemas/cart';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = ApplyPromoRequest.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }
  const cart = await resolveCart();
  try {
    const snap = await applyPromo(cart.id, parsed.code);
    return NextResponse.json(snap);
  } catch (e) {
    if (e instanceof PromoApplyError) {
      return NextResponse.json({ error: e.code, message: e.message }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(_req: Request) {
  const cart = await resolveCart();
  const snap = await removePromo(cart.id);
  return NextResponse.json(snap);
}
