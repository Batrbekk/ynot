'use client';

import * as React from 'react';

interface Props {
  prefix: string;
  value: string;
  onChange: (url: string) => void;
}

/**
 * Single-image upload widget for CMS forms (hero, lookbook). POSTs the file
 * to `/api/admin/media/upload?prefix=...` and propagates the resulting URL
 * back via `onChange`. Empty `value` shows an upload placeholder; non-empty
 * shows the image with a "Replace" affordance and a "Clear" button.
 */
export function SingleImageUpload({ prefix, value, onChange }: Props): React.ReactElement {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFile(file: File): Promise<void> {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('files', file);
      const res = await fetch(`/api/admin/media/upload?prefix=${encodeURIComponent(prefix)}`, {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) {
        setError(`Upload failed (${res.status})`);
        return;
      }
      const data = await res.json();
      if (data.rejected?.length > 0) {
        setError(`Rejected: ${data.rejected[0].reason}`);
        return;
      }
      const uploaded = data.uploaded?.[0];
      if (uploaded) onChange(uploaded.url);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {value ? (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className="w-32 h-32 object-cover rounded border border-neutral-200"
          />
          <div className="flex flex-col gap-2">
            <label className="inline-block cursor-pointer px-3 py-1.5 text-xs uppercase tracking-wider rounded border border-neutral-300 bg-white hover:bg-neutral-100">
              <span>{uploading ? 'Uploading…' : 'Replace'}</span>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => onChange('')}
              className="px-3 py-1.5 text-xs uppercase tracking-wider rounded border border-neutral-300 bg-white hover:bg-neutral-100 text-red-700"
            >
              Clear
            </button>
          </div>
        </div>
      ) : (
        <label className="inline-flex items-center justify-center cursor-pointer px-4 py-6 border-2 border-dashed border-neutral-300 rounded-lg text-sm text-neutral-600 bg-neutral-50 hover:bg-neutral-100">
          <span>{uploading ? 'Uploading…' : 'Choose image'}</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
        </label>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
