'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  productId: string;
}

/**
 * Two-step uploader: first POST the binary to `/api/admin/media/upload`
 * (which stores the file on disk and returns `{key, url}`), then attach the
 * URL to the product via `/api/admin/products/[id]/images`. We do them
 * sequentially per file so the user sees per-file progress and so a single
 * bad file (rejected MIME, oversized) doesn't abort the rest of the batch.
 */
export function ImageUploader({ productId }: Props): React.ReactElement {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);

  async function handleFiles(files: FileList | File[]): Promise<void> {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setError(null);
    setUploading(true);
    setProgress({ done: 0, total: arr.length });
    try {
      for (let i = 0; i < arr.length; i++) {
        const file = arr[i];
        const fd = new FormData();
        fd.append('files', file);
        const upRes = await fetch(
          `/api/admin/media/upload?prefix=products/${productId}`,
          { method: 'POST', body: fd },
        );
        if (!upRes.ok) {
          setError(`Upload failed (${upRes.status})`);
          break;
        }
        const upData = await upRes.json();
        if (upData.rejected?.length > 0) {
          setError(`Rejected: ${upData.rejected[0].reason}`);
          break;
        }
        const uploaded = upData.uploaded?.[0];
        if (!uploaded) continue;
        const attachRes = await fetch(`/api/admin/products/${productId}/images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: [{ url: uploaded.url, alt: '' }] }),
        });
        if (!attachRes.ok) {
          setError(`Attach failed (${attachRes.status})`);
          break;
        }
        setProgress({ done: i + 1, total: arr.length });
      }
      router.refresh();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      void handleFiles(e.dataTransfer.files);
    }
  }

  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      className="border-2 border-dashed border-neutral-300 rounded-lg p-6 text-center text-sm text-neutral-600 bg-neutral-50"
      data-testid="image-uploader"
    >
      <p className="mb-2">Drop images here or</p>
      <label className="inline-block cursor-pointer px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded">
        <span>{uploading ? 'Uploading…' : 'Choose files'}</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
          }}
        />
      </label>
      {progress && (
        <p className="mt-2 text-xs">
          {progress.done} / {progress.total}
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
