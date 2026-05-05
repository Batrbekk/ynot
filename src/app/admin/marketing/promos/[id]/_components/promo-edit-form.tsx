'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

interface Initial {
  code: string;
  discountType: 'FIXED' | 'PERCENT';
  discountValue: number;
  minOrderCents: number;
  usageLimit: number | null;
  usageCount: number;
  expiresAt: string | null; // ISO string or null
  isActive: boolean;
}

interface Props {
  id: string;
  initial: Initial;
}

/**
 * Edit form for an existing promo. The `code` field is displayed as a
 * static span — see service.ts for why we forbid renaming. The
 * `Deactivate` button posts to /api/admin/promos/[id]/deactivate after a
 * native confirm() so accidental clicks don't kill an active promo. We
 * intentionally don't expose a "delete" affordance since deactivation
 * preserves PromoRedemption referential integrity.
 */
export function PromoEditForm({ id, initial }: Props): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const [discountType, setDiscountType] = React.useState(initial.discountType);
  const [discountValue, setDiscountValue] = React.useState(String(initial.discountValue));
  const [minOrderCents, setMinOrderCents] = React.useState(String(initial.minOrderCents));
  const [usageLimit, setUsageLimit] = React.useState(
    initial.usageLimit === null ? '' : String(initial.usageLimit),
  );
  const [expiresAt, setExpiresAt] = React.useState(
    initial.expiresAt ? initial.expiresAt.slice(0, 16) : '',
  );
  const [isActive, setIsActive] = React.useState(initial.isActive);

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const value = Number.parseInt(discountValue, 10);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Discount value must be a positive integer.');
      return;
    }
    if (discountType === 'PERCENT' && value > 100) {
      setError('PERCENT discount must be 1..100.');
      return;
    }

    const min = Number.parseInt(minOrderCents, 10);
    const limit = usageLimit ? Number.parseInt(usageLimit, 10) : null;

    const body: Record<string, unknown> = {
      discountType,
      discountValue: value,
      minOrderCents: Number.isFinite(min) ? min : 0,
      usageLimit: limit,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      isActive,
    };

    startTransition(async () => {
      const res = await fetch(`/api/admin/promos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(`Save failed (${res.status})`);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  function onDeactivate(): void {
    if (!confirm(`Deactivate promo "${initial.code}"? Customers will no longer be able to redeem it. This is reversible — you can reactivate by checking "Active" in the form above and saving.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/promos/${id}/deactivate`, { method: 'POST' });
      if (!res.ok) {
        setError(`Deactivate failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">Code</span>
        <span className="px-3 py-2 bg-neutral-100 border border-neutral-200 rounded font-mono text-neutral-800">
          {initial.code}
        </span>
        <span className="text-xs text-neutral-500">
          Read-only. Deactivate this promo and create a new one to rotate.
        </span>
      </div>

      <div className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">Usage</span>
        <span className="px-3 py-2 bg-neutral-100 border border-neutral-200 rounded text-neutral-800">
          {initial.usageCount} / {initial.usageLimit ?? '∞'}
        </span>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">Discount type</span>
        <select
          value={discountType}
          onChange={(e) => setDiscountType(e.target.value as 'FIXED' | 'PERCENT')}
          className="border border-neutral-300 rounded px-3 py-2"
        >
          <option value="PERCENT">Percent (%)</option>
          <option value="FIXED">Fixed (£, in pence)</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">Discount value</span>
        <input
          type="number"
          min={1}
          step={1}
          value={discountValue}
          onChange={(e) => setDiscountValue(e.target.value)}
          required
          className="border border-neutral-300 rounded px-3 py-2 w-32"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">
          Minimum order (pence)
        </span>
        <input
          type="number"
          min={0}
          step={1}
          value={minOrderCents}
          onChange={(e) => setMinOrderCents(e.target.value)}
          className="border border-neutral-300 rounded px-3 py-2 w-32"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">
          Usage limit (blank = unlimited)
        </span>
        <input
          type="number"
          min={1}
          step={1}
          value={usageLimit}
          onChange={(e) => setUsageLimit(e.target.value)}
          className="border border-neutral-300 rounded px-3 py-2 w-32"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">
          Expires at (blank = never)
        </span>
        <input
          type="datetime-local"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="border border-neutral-300 rounded px-3 py-2"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        <span>Active</span>
      </label>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {saved && <p className="text-sm text-green-700">Saved.</p>}
      <div className="flex gap-3 mt-2">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        {initial.isActive && (
          <button
            type="button"
            onClick={onDeactivate}
            disabled={pending}
            className="ml-auto px-4 py-2 border border-red-300 text-red-700 text-xs uppercase tracking-wider rounded hover:bg-red-50 disabled:opacity-50"
          >
            Deactivate
          </button>
        )}
      </div>
    </form>
  );
}
