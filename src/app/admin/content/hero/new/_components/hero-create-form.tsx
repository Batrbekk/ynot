'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { SingleImageUpload } from '../../../_components/single-image-upload';

/**
 * Hero create form. New heroes are always inserted with `isActive=false` —
 * activation is a separate explicit step (Activate button on the list page)
 * so accidental imports don't clobber the live hero.
 */
export function HeroCreateForm(): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [kind, setKind] = React.useState<'IMAGE' | 'VIDEO'>('IMAGE');
  const [imageUrl, setImageUrl] = React.useState('');
  const [videoUrl, setVideoUrl] = React.useState('');
  const [eyebrow, setEyebrow] = React.useState('');
  const [ctaLabel, setCtaLabel] = React.useState('');
  const [ctaHref, setCtaHref] = React.useState('');

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);
    if (!imageUrl || !eyebrow || !ctaLabel || !ctaHref) {
      setError('Image, eyebrow, CTA label and CTA href are required.');
      return;
    }
    if (kind === 'VIDEO' && !videoUrl) {
      setError('Video URL is required when kind is VIDEO.');
      return;
    }
    startTransition(async () => {
      const res = await fetch('/api/admin/content/hero', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          imageUrl,
          videoUrl: kind === 'VIDEO' ? videoUrl : undefined,
          eyebrow,
          ctaLabel,
          ctaHref,
        }),
      });
      if (!res.ok) {
        setError(`Create failed (${res.status})`);
        return;
      }
      const hero = await res.json();
      router.push(`/admin/content/hero/${hero.id}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">Kind</span>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as 'IMAGE' | 'VIDEO')}
          className="border border-neutral-300 rounded px-3 py-2 bg-white"
        >
          <option value="IMAGE">Image</option>
          <option value="VIDEO">Video</option>
        </select>
      </label>
      <div className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">Image</span>
        <SingleImageUpload prefix="hero" value={imageUrl} onChange={setImageUrl} />
        <label className="flex flex-col gap-1 mt-2">
          <span className="text-xs uppercase tracking-wider text-neutral-600">Image URL</span>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            required
            className="border border-neutral-300 rounded px-3 py-2 font-mono text-xs"
          />
        </label>
      </div>
      {kind === 'VIDEO' && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wider text-neutral-600">Video URL</span>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            className="border border-neutral-300 rounded px-3 py-2 font-mono text-xs"
          />
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">Eyebrow</span>
        <input
          type="text"
          value={eyebrow}
          onChange={(e) => setEyebrow(e.target.value)}
          required
          maxLength={120}
          className="border border-neutral-300 rounded px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">CTA label</span>
        <input
          type="text"
          value={ctaLabel}
          onChange={(e) => setCtaLabel(e.target.value)}
          required
          maxLength={60}
          className="border border-neutral-300 rounded px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">CTA href</span>
        <input
          type="text"
          value={ctaHref}
          onChange={(e) => setCtaHref(e.target.value)}
          required
          maxLength={500}
          className="border border-neutral-300 rounded px-3 py-2 font-mono text-xs"
        />
      </label>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-3 mt-2">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded disabled:opacity-50"
        >
          {pending ? 'Creating…' : 'Create hero'}
        </button>
      </div>
    </form>
  );
}
