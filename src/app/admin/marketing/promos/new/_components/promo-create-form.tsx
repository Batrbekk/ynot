'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

/**
 * Create form for `/admin/marketing/promos/new`. The Zod regex on the
 * server already enforces uppercase A-Z, digits, `_`, `-`; we surface
 * that constraint as the input's `pattern` so the browser flags it
 * pre-submit too. We deliberately do NOT auto-uppercase user input — if
 * an operator types lowercase, they should see exactly what they typed
 * before correcting (keeps the rule visible).
 */
export function PromoCreateForm(): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [code, setCode] = React.useState('');
  const [discountType, setDiscountType] = React.useState<'FIXED' | 'PERCENT'>('PERCENT');
  const [discountValue, setDiscountValue] = React.useState('10');
  const [minOrderCents, setMinOrderCents] = React.useState('0');
  const [usageLimit, setUsageLimit] = React.useState('');
  const [expiresAt, setExpiresAt] = React.useState('');
  const [isActive, setIsActive] = React.useState(true);

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);

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
    const limit = usageLimit ? Number.parseInt(usageLimit, 10) : undefined;

    const body: Record<string, unknown> = {
      code,
      discountType,
      discountValue: value,
      minOrderCents: Number.isFinite(min) ? min : 0,
      isActive,
    };
    if (limit !== undefined && Number.isFinite(limit)) body.usageLimit = limit;
    if (expiresAt) body.expiresAt = new Date(expiresAt).toISOString();

    startTransition(async () => {
      const res = await fetch('/api/admin/promos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        if (res.status === 409) {
          const data = await res.json().catch(() => null);
          setError(data?.message ?? 'Code already exists.');
        } else {
          setError(`Create failed (${res.status})`);
        }
        return;
      }
      const p = await res.json();
      router.push(`/admin/marketing/promos/${p.id}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">Code</span>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          minLength={3}
          maxLength={30}
          pattern="[A-Z0-9_-]+"
          placeholder="WELCOME10"
          className="border border-neutral-300 rounded px-3 py-2 font-mono"
        />
        <span className="text-xs text-neutral-500">
          Uppercase A-Z, digits, _, -. Cannot be changed after creation.
        </span>
      </label>

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
        <span className="text-xs uppercase tracking-wider text-neutral-600">
          Discount value
        </span>
        <input
          type="number"
          min={1}
          step={1}
          value={discountValue}
          onChange={(e) => setDiscountValue(e.target.value)}
          required
          className="border border-neutral-300 rounded px-3 py-2 w-32"
        />
        <span className="text-xs text-neutral-500">
          PERCENT: 1..100. FIXED: amount in pence (e.g. 500 = £5.00).
        </span>
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
      <div className="flex gap-3 mt-2">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded disabled:opacity-50"
        >
          {pending ? 'Creating…' : 'Create promo'}
        </button>
      </div>
    </form>
  );
}
