'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { SingleImageUpload } from '../../../_components/single-image-upload';

export function LookbookCreateForm(): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [src, setSrc] = React.useState('');
  const [alt, setAlt] = React.useState('');
  const [productSlug, setProductSlug] = React.useState('');

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);
    if (!src) {
      setError('Image is required.');
      return;
    }
    startTransition(async () => {
      const res = await fetch('/api/admin/content/lookbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          src,
          alt,
          productSlug: productSlug || null,
        }),
      });
      if (!res.ok) {
        setError(`Create failed (${res.status})`);
        return;
      }
      router.push('/admin/content/lookbook');
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">Image</span>
        <SingleImageUpload prefix="lookbook" value={src} onChange={setSrc} />
        <label className="flex flex-col gap-1 mt-2">
          <span className="text-xs uppercase tracking-wider text-neutral-600">
            Image URL
          </span>
          <input
            type="url"
            value={src}
            onChange={(e) => setSrc(e.target.value)}
            required
            className="border border-neutral-300 rounded px-3 py-2 font-mono text-xs"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">Alt text</span>
        <input
          type="text"
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          maxLength={200}
          className="border border-neutral-300 rounded px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">
          Product slug (optional link)
        </span>
        <input
          type="text"
          value={productSlug}
          onChange={(e) => setProductSlug(e.target.value)}
          maxLength={200}
          className="border border-neutral-300 rounded px-3 py-2 font-mono text-xs"
          placeholder="e.g. spring-coat"
        />
      </label>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-3 mt-2">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded disabled:opacity-50"
        >
          {pending ? 'Creating…' : 'Create image'}
        </button>
      </div>
    </form>
  );
}
