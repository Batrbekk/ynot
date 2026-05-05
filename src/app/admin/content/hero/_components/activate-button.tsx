'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  id: string;
}

/**
 * Promotes a hero block to live. POSTs to `/activate` and refreshes the
 * server component so the active badge moves to the new row.
 */
export function ActivateButton({ id }: Props): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function activate(): void {
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/admin/content/hero/${id}/activate`, {
        method: 'POST',
      });
      if (!res.ok) {
        setError(`Activate failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={activate}
        disabled={pending}
        className="px-3 py-1 text-xs uppercase tracking-wider rounded border border-neutral-300 bg-white hover:bg-neutral-100 disabled:opacity-50"
      >
        {pending ? 'Activating…' : 'Activate'}
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
