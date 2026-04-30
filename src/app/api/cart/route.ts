import { NextResponse } from 'next/server';
import { resolveCart } from '@/server/cart/resolve';
import { snapshotCart } from '@/server/cart/service';
import { prisma } from '@/server/db/client';

export const runtime = 'nodejs';

export async function GET(_req: Request) {
  const cart = await resolveCart();
  const snap = await snapshotCart(cart.id);
  return NextResponse.json(snap);
}

export async function DELETE(_req: Request) {
  const cart = await resolveCart();
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  await prisma.cart.update({ where: { id: cart.id }, data: { promoCodeId: null } });
  const snap = await snapshotCart(cart.id);
  return NextResponse.json(snap);
}
