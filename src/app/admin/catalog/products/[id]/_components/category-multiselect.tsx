'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

interface Props {
  productId: string;
  categories: CategoryNode[];
  selectedIds: string[];
}

/**
 * Tree-aware multiselect: roots are rendered as outer `<li>`s and children
 * indent under their parent. Selection is flat (a list of category ids) —
 * checking a parent doesn't auto-check descendants because category trees
 * are at most 2 levels deep in the YNOT taxonomy and admins prefer the
 * explicit click.
 */
export function CategoryMultiselect({
  productId,
  categories,
  selectedIds,
}: Props): React.ReactElement {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set(selectedIds));
  const [pending, startTransition] = React.useTransition();
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const tree = React.useMemo(() => {
    const roots: CategoryNode[] = [];
    const byParent = new Map<string, CategoryNode[]>();
    for (const c of categories) {
      if (c.parentId) {
        const arr = byParent.get(c.parentId) ?? [];
        arr.push(c);
        byParent.set(c.parentId, arr);
      } else {
        roots.push(c);
      }
    }
    return { roots, byParent };
  }, [categories]);

  function toggle(id: string): void {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onSave(): void {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryIds: Array.from(selected) }),
      });
      if (!res.ok) {
        setError(`Save failed (${res.status})`);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  function renderNode(c: CategoryNode, depth: number): React.ReactElement {
    const children = tree.byParent.get(c.id) ?? [];
    return (
      <li key={c.id} style={{ marginLeft: depth * 16 }}>
        <label className="flex items-center gap-2 text-sm py-0.5">
          <input
            type="checkbox"
            checked={selected.has(c.id)}
            onChange={() => toggle(c.id)}
            data-testid={`cat-${c.id}`}
          />
          <span>{c.name}</span>
          <span className="text-xs text-neutral-500 font-mono">/{c.slug}</span>
        </label>
        {children.length > 0 && (
          <ul className="list-none p-0">
            {children.map((child) => renderNode(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-4">
      {tree.roots.length === 0 ? (
        <p className="text-xs text-neutral-500">No categories yet.</p>
      ) : (
        <ul className="list-none p-0">
          {tree.roots.map((root) => renderNode(root, 0))}
        </ul>
      )}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save categories'}
        </button>
        {saved && <span className="text-xs text-green-700">Saved.</span>}
        {error && <span className="text-xs text-red-700">{error}</span>}
      </div>
    </div>
  );
}
