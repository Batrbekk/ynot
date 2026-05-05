import * as React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/server/db/client';
import { LookbookEditForm } from './_components/lookbook-edit-form';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

export default async function AdminLookbookDetailPage({
  params,
}: Ctx): Promise<React.ReactElement> {
  const { id } = await params;
  const img = await prisma.lookbookImage.findUnique({ where: { id } });
  if (!img) notFound();

  return (
    <div className="max-w-2xl">
      <div className="mb-6 text-sm">
        <Link href="/admin/content/lookbook" className="text-neutral-600 underline">
          ← Back to lookbook
        </Link>
      </div>
      <h2 className="text-2xl font-semibold mb-6">Edit lookbook image</h2>
      <LookbookEditForm
        id={img.id}
        initial={{ src: img.src, alt: img.alt, productSlug: img.productSlug }}
      />
    </div>
  );
}
