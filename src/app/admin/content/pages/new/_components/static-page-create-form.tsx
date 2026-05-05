'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

/**
 * Minimal create form: rich Markdown body editing happens on the detail
 * page so this just collects title + optional slug and redirects.
 */
export function StaticPageCreateForm(): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState('');
  const [slug, setSlug] = React.useState('');

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);
    if (!title) {
      setError('Title is required.');
      return;
    }
    startTransition(async () => {
      const res = await fetch('/api/admin/content/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          slug: slug || undefined,
        }),
      });
      if (!res.ok) {
        setError(`Create failed (${res.status})`);
        return;
      }
      const page = await res.json();
      router.push(`/admin/content/pages/${page.id}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">Title</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          className="border border-neutral-300 rounded px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">
          Slug (auto from title if blank)
        </span>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          maxLength={200}
          className="border border-neutral-300 rounded px-3 py-2 font-mono"
        />
      </label>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-3 mt-2">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded disabled:opacity-50"
        >
          {pending ? 'Creating…' : 'Create page'}
        </button>
      </div>
    </form>
  );
}
