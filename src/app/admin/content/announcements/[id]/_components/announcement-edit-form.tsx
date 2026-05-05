'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  id: string;
  initial: { text: string; sortOrder: number; isActive: boolean };
}

export function AnnouncementEditForm({ id, initial }: Props): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [text, setText] = React.useState(initial.text);
  const [sortOrder, setSortOrder] = React.useState(String(initial.sortOrder));
  const [isActive, setIsActive] = React.useState(initial.isActive);

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const order = Number.parseInt(sortOrder, 10);
    startTransition(async () => {
      const res = await fetch(`/api/admin/content/announcements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          sortOrder: Number.isFinite(order) ? order : 0,
          isActive,
        }),
      });
      if (!res.ok) {
        setError(`Save failed (${res.status})`);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  function onDelete(): void {
    if (!confirm('Delete this announcement?')) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/content/announcements/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setError(`Delete failed (${res.status})`);
        return;
      }
      router.push('/admin/content/announcements');
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">Text</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
          maxLength={280}
          rows={3}
          className="border border-neutral-300 rounded px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">Sort order</span>
        <input
          type="number"
          min={0}
          step={1}
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="border border-neutral-300 rounded px-3 py-2 w-32"
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
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="ml-auto px-4 py-2 border border-red-300 text-red-700 text-xs uppercase tracking-wider rounded hover:bg-red-50 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </form>
  );
}
