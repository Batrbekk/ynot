import { NextResponse } from 'next/server';
import { resolveCart } from '@/server/cart/resolve';
import { setQuantity, removeItem, StockConflictError } from '@/server/cart/service';
import { SetQuantityRequest } from '@/lib/schemas/cart';
import { prisma } from '@/server/db/client';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

async function assertItemBelongs(cartId: string, itemId: string) {
  const item = await prisma.cartItem.findUnique({ where: { id: itemId } });
  if (!item || item.cartId !== cartId) return false;
  return true;
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id: itemId } = await params;
  let parsed;
  try {
    parsed = SetQuantityRequest.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }
  const cart = await resolveCart();
  if (!(await assertItemBelongs(cart.id, itemId))) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
  try {
    const snap = await setQuantity(cart.id, itemId, parsed.quantity);
    return NextResponse.json(snap);
  } catch (e) {
    if (e instanceof StockConflictError) {
      return NextResponse.json(
        { error: 'STOCK_CONFLICT', stockAvailable: e.stockAvailable },
        { status: 409 },
      );
    }
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id: itemId } = await params;
  const cart = await resolveCart();
  if (!(await assertItemBelongs(cart.id, itemId))) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
  const snap = await removeItem(cart.id, itemId);
  return NextResponse.json(snap);
}
