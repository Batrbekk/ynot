import { NextResponse } from 'next/server';
import { resolveCart } from '@/server/cart/resolve';
import { snapshotCart } from '@/server/cart/service';
import { getShippingProvider } from '@/server/shipping/zones';
import { QuoteRequest } from '@/lib/schemas/checkout';
import { prisma } from '@/server/db/client';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = QuoteRequest.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }
  const cart = await resolveCart();
  const snap = await snapshotCart(cart.id);
  const subtotalAfterDiscount = snap.subtotalCents - snap.discountCents;

  // Build items with weight/origin from Product table.
  const productIds = snap.items.map((i) => i.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const itemsForRate = snap.items.map((i) => {
    const p = products.find((x) => x.id === i.productId);
    return {
      productId: i.productId,
      quantity: i.quantity,
      weightGrams: p?.weightGrams ?? 1500,
      unitPriceCents: i.unitPriceCents,
      hsCode: p?.hsCode ?? undefined,
      countryOfOriginCode: p?.countryOfOriginCode ?? undefined,
    };
  });

  const provider = getShippingProvider();
  const methods = await provider.quote({
    origin: { country: 'GB' },
    destination: { countryCode: parsed.address.countryCode, postcode: parsed.address.postcode },
    items: itemsForRate,
    subtotalCents: subtotalAfterDiscount,
  });

  return NextResponse.json({ methods });
}
