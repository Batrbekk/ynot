'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

export interface ParentOption {
  id: string;
  name: string;
  depth: number;
}

interface Props {
  parentOptions: ParentOption[];
}

/**
 * Minimal create form: the rich editing happens on the detail page so this
 * collects the bare minimum (name, optional slug, parent, description) and
 * redirects to the detail editor on success.
 */
export function CategoryCreateForm({ parentOptions }: Props): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [parentId, setParentId] = React.useState('');
  const [description, setDescription] = React.useState('');

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);
    if (!name) {
      setError('Name is required.');
      return;
    }
    startTransition(async () => {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug: slug || undefined,
          parentId: parentId || null,
          description,
        }),
      });
      if (!res.ok) {
        setError(`Create failed (${res.status})`);
        return;
      }
      const cat = await res.json();
      router.push(`/admin/catalog/categories/${cat.id}`);
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
          maxLength={100}
          className="border border-neutral-300 rounded px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">
          Slug (auto from name if blank)
        </span>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          maxLength={100}
          className="border border-neutral-300 rounded px-3 py-2 font-mono"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">Parent</span>
        <select
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className="border border-neutral-300 rounded px-3 py-2 bg-white"
        >
          <option value="">— None (root) —</option>
          {parentOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {'  '.repeat(opt.depth)}
              {opt.depth > 0 ? '↳ ' : ''}
              {opt.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
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
          {pending ? 'Creating…' : 'Create category'}
        </button>
      </div>
    </form>
  );
}
