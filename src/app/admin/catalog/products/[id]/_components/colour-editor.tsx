'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

interface ColourRow {
  name: string;
  hex: string;
}

interface Props {
  productId: string;
  initial: ColourRow[];
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Colour editor — variable-length list of `{name, hex}` pairs. Server replaces
 * the full set on save (see `setProductColours`), so add/remove are purely
 * client state until the user hits "Save".
 */
export function ColourEditor({ productId, initial }: Props): React.ReactElement {
  const router = useRouter();
  const [rows, setRows] = React.useState<ColourRow[]>(initial);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  function update(i: number, patch: Partial<ColourRow>): void {
    setSaved(false);
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function add(): void {
    setSaved(false);
    setRows((prev) => [...prev, { name: '', hex: '#000000' }]);
  }
  function remove(i: number): void {
    setSaved(false);
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function onSave(): void {
    setError(null);
    setSaved(false);
    for (const r of rows) {
      if (!r.name.trim()) {
        setError('Colour name is required.');
        return;
      }
      if (!HEX_RE.test(r.hex)) {
        setError(`Invalid hex: ${r.hex}`);
        return;
      }
    }
    startTransition(async () => {
      const res = await fetch(`/api/admin/products/${productId}/colours`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colours: rows }),
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
      <div className="flex flex-col gap-2">
        {rows.length === 0 && (
          <p className="text-xs text-neutral-500">No colours yet.</p>
        )}
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2" data-testid={`colour-row-${i}`}>
            <input
              type="text"
              placeholder="Name (e.g. Charcoal)"
              value={r.name}
              onChange={(e) => update(i, { name: e.target.value })}
              className="border border-neutral-300 rounded px-3 py-2 flex-1 text-sm"
            />
            <input
              type="color"
              value={r.hex}
              onChange={(e) => update(i, { hex: e.target.value })}
              className="border border-neutral-300 rounded h-10 w-12"
            />
            <input
              type="text"
              value={r.hex}
              onChange={(e) => update(i, { hex: e.target.value })}
              maxLength={7}
              className="border border-neutral-300 rounded px-2 py-2 w-24 font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remove colour"
              className="px-2 py-1 text-xs text-red-700"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={add}
          className="px-3 py-1.5 border border-neutral-300 rounded text-xs uppercase tracking-wider"
        >
          + Add colour
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save colours'}
        </button>
        {saved && <span className="text-xs text-green-700">Saved.</span>}
        {error && <span className="text-xs text-red-700">{error}</span>}
      </div>
    </div>
  );
}
