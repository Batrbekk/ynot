'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

/**
 * Minimal create form: product is born as DRAFT (server enforces) and the
 * detail page is where the rich editing happens — so this just collects the
 * fields the service requires and redirects to the detail editor.
 */
export function ProductCreateForm(): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [priceCents, setPriceCents] = React.useState('');

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);
    const price = Number.parseInt(priceCents, 10);
    if (!name || !description || !Number.isFinite(price) || price <= 0) {
      setError('Name, description and price are required.');
      return;
    }
    startTransition(async () => {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          priceCents: price,
          materials: '',
          care: '',
          sizing: '',
          preOrder: false,
        }),
      });
      if (!res.ok) {
        setError(`Create failed (${res.status})`);
        return;
      }
      const product = await res.json();
      router.push(`/admin/catalog/products/${product.id}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">Name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={200}
          className="border border-neutral-300 rounded px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={4}
          className="border border-neutral-300 rounded px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">
          Price (in pence, e.g. 4500 = £45.00)
        </span>
        <input
          type="number"
          min={1}
          step={1}
          value={priceCents}
          onChange={(e) => setPriceCents(e.target.value)}
          required
          className="border border-neutral-300 rounded px-3 py-2"
        />
      </label>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-3 mt-2">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded disabled:opacity-50"
        >
          {pending ? 'Creating…' : 'Create product'}
        </button>
      </div>
    </form>
  );
}
