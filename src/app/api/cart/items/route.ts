import { NextResponse } from 'next/server';
import { resolveCart } from '@/server/cart/resolve';
import { addItem, StockConflictError } from '@/server/cart/service';
import { AddItemRequest } from '@/lib/schemas/cart';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = AddItemRequest.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }
  const cart = await resolveCart();
  try {
    const snap = await addItem(cart.id, parsed);
    return NextResponse.json(snap);
  } catch (e) {
    if (e instanceof StockConflictError) {
      return NextResponse.json(
        { error: 'STOCK_CONFLICT', productId: e.productId, size: e.size, stockAvailable: e.stockAvailable },
        { status: 409 },
      );
    }
    throw e;
  }
}
