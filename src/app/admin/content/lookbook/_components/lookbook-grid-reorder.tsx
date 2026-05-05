'use client';

import * as React from 'react';
import { Reorder } from 'motion/react';
import { useRouter } from 'next/navigation';

interface Item {
  id: string;
  src: string;
  alt: string;
  sortOrder: number;
}

interface Props {
  items: Item[];
}

/**
 * Drag-to-reorder grid mirroring the product image grid pattern. Local state
 * holds the live order during the drag and only commits to the server when
 * the user releases an item AND the order actually changed. Posts the new
 * id-array via `PATCH /api/admin/content/lookbook`.
 */
export function LookbookGridReorder(props: Props): React.ReactElement {
  // Re-mount when the parent's `items` identity changes (server snapshot
  // refresh) so we don't have to re-sync `useState` via an effect.
  const key = props.items.map((i) => i.id).join('|');
  return <LookbookGridReorderInner key={key} {...props} />;
}

function LookbookGridReorderInner({ items: initial }: Props): React.ReactElement {
  const router = useRouter();
  const [items, setItems] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function commitOrder(next: Item[]): void {
    const same =
      next.length === items.length && next.every((it, i) => it.id === items[i].id);
    if (same) return;
    setItems(next);
    const sameAsServer =
      next.length === initial.length && next.every((it, i) => it.id === initial[i].id);
    if (sameAsServer) return;
    startTransition(async () => {
      setError(null);
      const res = await fetch('/api/admin/content/lookbook', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: next.map((it) => it.id) }),
      });
      if (!res.ok) {
        setError(`Reorder failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  }

  function remove(id: string): void {
    if (!confirm('Delete this image?')) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/content/lookbook/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setError(`Delete failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  }

  if (items.length === 0) {
    return <p className="text-sm text-neutral-500 mt-4">No lookbook images yet.</p>;
  }

  return (
    <div>
      <Reorder.Group
        axis="x"
        values={items}
        onReorder={commitOrder}
        className="flex flex-wrap gap-3 mt-4 list-none p-0"
      >
        {items.map((img) => (
          <Reorder.Item
            key={img.id}
            value={img}
            className="relative w-40 h-52 bg-neutral-100 rounded overflow-hidden cursor-grab active:cursor-grabbing"
            data-testid={`lookbook-${img.id}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.src}
              alt={img.alt}
              className="w-full h-full object-cover pointer-events-none"
              draggable={false}
            />
            <a
              href={`/admin/content/lookbook/${img.id}`}
              className="absolute bottom-1 left-1 px-2 py-0.5 text-xs bg-white/90 rounded shadow"
              onPointerDown={(e) => e.stopPropagation()}
            >
              Edit
            </a>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(img.id);
              }}
              disabled={pending}
              className="absolute top-1 right-1 px-2 py-0.5 text-xs bg-white/90 text-red-700 rounded shadow"
            >
              ×
            </button>
          </Reorder.Item>
        ))}
      </Reorder.Group>
      {error && <p className="text-xs text-red-700 mt-2">{error}</p>}
    </div>
  );
}
