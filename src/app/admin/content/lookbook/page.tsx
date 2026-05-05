import * as React from 'react';
import Link from 'next/link';
import { prisma } from '@/server/db/client';
import { LookbookGridReorder } from './_components/lookbook-grid-reorder';

export const dynamic = 'force-dynamic';

export default async function AdminLookbookPage(): Promise<React.ReactElement> {
  const items = await prisma.lookbookImage.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Lookbook</h2>
        <Link
          href="/admin/content/lookbook/new"
          className="px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded"
        >
          New image
        </Link>
      </div>
      <p className="text-sm text-neutral-600 mb-2">
        Drag to reorder. Click an image to edit its alt text or product link.
      </p>
      <LookbookGridReorder
        items={items.map((i) => ({
          id: i.id,
          src: i.src,
          alt: i.alt,
          sortOrder: i.sortOrder,
        }))}
      />
    </div>
  );
}
