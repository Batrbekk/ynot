import * as React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/server/db/client';
import { PromoEditForm } from './_components/promo-edit-form';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

export default async function AdminPromoDetailPage({ params }: Ctx): Promise<React.ReactElement> {
  const { id } = await params;
  const p = await prisma.promoCode.findUnique({ where: { id } });
  if (!p) notFound();

  return (
    <div className="max-w-2xl">
      <div className="mb-6 text-sm">
        <Link href="/admin/marketing/promos" className="text-neutral-600 underline">
          ← Back to promos
        </Link>
      </div>
      <h2 className="text-2xl font-semibold mb-6">Edit promo</h2>
      <PromoEditForm
        id={p.id}
        initial={{
          code: p.code,
          discountType: p.discountType,
          discountValue: p.discountValue,
          minOrderCents: p.minOrderCents,
          usageLimit: p.usageLimit,
          usageCount: p.usageCount,
          expiresAt: p.expiresAt ? p.expiresAt.toISOString() : null,
          isActive: p.isActive,
        }}
      />
    </div>
  );
}
