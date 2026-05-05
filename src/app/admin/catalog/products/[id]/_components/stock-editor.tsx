'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

const SIZES = ['XS', 'S', 'M', 'L', 'XL'] as const;
type Size = (typeof SIZES)[number];

interface SizeRow {
  size: Size;
  stock: number;
}

interface Props {
  productId: string;
  initial: Array<{ size: string; stock: number }>;
}

/**
 * Stock editor renders one row per size in the canonical XS→XL order. Sizes
 * with no existing row default to 0; on save we always send all five so the
 * upsert path on the server is symmetric (no implicit "missing = keep").
 */
export function StockEditor({ productId, initial }: Props): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const initialMap = new Map(
    initial.map((r) => [r.size as Size, r.stock] as const),
  );
  const [rows, setRows] = React.useState<SizeRow[]>(
    SIZES.map((s) => ({ size: s, stock: initialMap.get(s) ?? 0 })),
  );

  function set(size: Size, value: number): void {
    setSaved(false);
    setRows((prev) => prev.map((r) => (r.size === size ? { ...r, stock: value } : r)));
  }

  function onSave(): void {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await fetch(`/api/admin/products/${productId}/sizes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sizes: rows }),
      });
      if (!res.ok) {
        setError(`Save failed (${res.status})`);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-4">
      <div className="grid grid-cols-5 gap-3">
        {rows.map((r) => (
          <label key={r.size} className="flex flex-col gap-1 text-sm">
            <span className="text-xs uppercase tracking-wider text-neutral-600">
              {r.size}
            </span>
            <input
              type="number"
              min={0}
              value={r.stock}
              onChange={(e) => set(r.size, Math.max(0, Number.parseInt(e.target.value, 10) || 0))}
              className="border border-neutral-300 rounded px-3 py-2"
              data-testid={`stock-${r.size}`}
            />
          </label>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save stock'}
        </button>
        {saved && <span className="text-xs text-green-700">Saved.</span>}
        {error && <span className="text-xs text-red-700">{error}</span>}
      </div>
    </div>
  );
}
