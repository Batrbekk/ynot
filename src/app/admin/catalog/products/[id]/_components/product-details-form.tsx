'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

export interface ProductDetailsInitial {
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  materials: string;
  care: string;
  sizing: string;
  weightGrams: number | null;
  hsCode: string | null;
  countryOfOriginCode: string | null;
  preOrder: boolean;
}

interface Props {
  productId: string;
  initial: ProductDetailsInitial;
}

export function ProductDetailsForm({ productId, initial }: Props): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [state, setState] = React.useState(initial);

  function update<K extends keyof ProductDetailsInitial>(
    key: K,
    value: ProductDetailsInitial[K],
  ): void {
    setState((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const body: Record<string, unknown> = {
        name: state.name,
        slug: state.slug,
        description: state.description,
        priceCents: state.priceCents,
        materials: state.materials,
        care: state.care,
        sizing: state.sizing,
        preOrder: state.preOrder,
      };
      if (state.weightGrams) body.weightGrams = state.weightGrams;
      if (state.hsCode) body.hsCode = state.hsCode;
      if (state.countryOfOriginCode) body.countryOfOriginCode = state.countryOfOriginCode;
      const res = await fetch(`/api/admin/products/${productId}`, {
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

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Name">
        <input
          type="text"
          value={state.name}
          onChange={(e) => update('name', e.target.value)}
          className="border border-neutral-300 rounded px-3 py-2 w-full"
        />
      </Field>
      <Field label="Slug">
        <input
          type="text"
          value={state.slug}
          onChange={(e) => update('slug', e.target.value)}
          className="border border-neutral-300 rounded px-3 py-2 w-full font-mono text-sm"
        />
      </Field>
      <div className="md:col-span-2">
        <Field label="Description">
          <textarea
            value={state.description}
            onChange={(e) => update('description', e.target.value)}
            rows={4}
            className="border border-neutral-300 rounded px-3 py-2 w-full"
          />
        </Field>
      </div>
      <Field label="Price (pence)">
        <input
          type="number"
          min={1}
          value={state.priceCents}
          onChange={(e) => update('priceCents', Number.parseInt(e.target.value, 10) || 0)}
          className="border border-neutral-300 rounded px-3 py-2 w-full"
        />
      </Field>
      <Field label="Weight (grams)">
        <input
          type="number"
          min={1}
          value={state.weightGrams ?? ''}
          onChange={(e) =>
            update(
              'weightGrams',
              e.target.value ? Number.parseInt(e.target.value, 10) : null,
            )
          }
          className="border border-neutral-300 rounded px-3 py-2 w-full"
        />
      </Field>
      <Field label="Materials">
        <textarea
          value={state.materials}
          onChange={(e) => update('materials', e.target.value)}
          rows={2}
          className="border border-neutral-300 rounded px-3 py-2 w-full"
        />
      </Field>
      <Field label="Care">
        <textarea
          value={state.care}
          onChange={(e) => update('care', e.target.value)}
          rows={2}
          className="border border-neutral-300 rounded px-3 py-2 w-full"
        />
      </Field>
      <Field label="Sizing notes">
        <textarea
          value={state.sizing}
          onChange={(e) => update('sizing', e.target.value)}
          rows={2}
          className="border border-neutral-300 rounded px-3 py-2 w-full"
        />
      </Field>
      <Field label="HS Code">
        <input
          type="text"
          value={state.hsCode ?? ''}
          onChange={(e) => update('hsCode', e.target.value || null)}
          className="border border-neutral-300 rounded px-3 py-2 w-full font-mono text-sm"
        />
      </Field>
      <Field label="Country of Origin (ISO 2)">
        <input
          type="text"
          maxLength={2}
          value={state.countryOfOriginCode ?? ''}
          onChange={(e) => update('countryOfOriginCode', e.target.value.toUpperCase() || null)}
          className="border border-neutral-300 rounded px-3 py-2 w-full font-mono text-sm uppercase"
        />
      </Field>
      <label className="flex items-center gap-2 text-sm md:col-span-2">
        <input
          type="checkbox"
          checked={state.preOrder}
          onChange={(e) => update('preOrder', e.target.checked)}
        />
        <span>Pre-order</span>
      </label>

      <div className="md:col-span-2 flex items-center gap-3 mt-2">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save details'}
        </button>
        {saved && <span className="text-xs text-green-700">Saved.</span>}
        {error && <span className="text-xs text-red-700">{error}</span>}
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs uppercase tracking-wider text-neutral-600">{label}</span>
      {children}
    </label>
  );
}
