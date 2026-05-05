'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { ProductStatus } from '@prisma/client';

interface Props {
  productId: string;
  status: ProductStatus;
}

/**
 * The state machine: DRAFT ↔ PUBLISHED, DRAFT → ARCHIVED, PUBLISHED → ARCHIVED.
 * ARCHIVED is terminal. We mirror `assertProductTransition` here so the buttons
 * can be greyed-out without round-tripping to the server first.
 */
const LEGAL: Record<ProductStatus, ProductStatus[]> = {
  DRAFT: ['PUBLISHED', 'ARCHIVED'],
  PUBLISHED: ['DRAFT', 'ARCHIVED'],
  ARCHIVED: [],
};

export function StatusActions({ productId, status }: Props): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function transition(to: ProductStatus): void {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/products/${productId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to }),
      });
      if (!res.ok) {
        setError(`Status change failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  }

  const legal = LEGAL[status];
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending || !legal.includes('PUBLISHED')}
          onClick={() => transition('PUBLISHED')}
          className="px-3 py-1.5 text-xs uppercase tracking-wider rounded bg-green-700 text-white disabled:opacity-30"
        >
          Publish
        </button>
        <button
          type="button"
          disabled={pending || !legal.includes('DRAFT')}
          onClick={() => transition('DRAFT')}
          className="px-3 py-1.5 text-xs uppercase tracking-wider rounded bg-yellow-600 text-white disabled:opacity-30"
        >
          Unpublish
        </button>
        <button
          type="button"
          disabled={pending || !legal.includes('ARCHIVED')}
          onClick={() => transition('ARCHIVED')}
          className="px-3 py-1.5 text-xs uppercase tracking-wider rounded bg-neutral-700 text-white disabled:opacity-30"
        >
          Archive
        </button>
      </div>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
