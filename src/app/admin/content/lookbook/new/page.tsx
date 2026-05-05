import * as React from 'react';
import Link from 'next/link';
import { LookbookCreateForm } from './_components/lookbook-create-form';

export const dynamic = 'force-dynamic';

export default function AdminLookbookNewPage(): React.ReactElement {
  return (
    <div className="max-w-2xl">
      <div className="mb-6 text-sm">
        <Link href="/admin/content/lookbook" className="text-neutral-600 underline">
          ← Back to lookbook
        </Link>
      </div>
      <h2 className="text-2xl font-semibold mb-6">New lookbook image</h2>
      <LookbookCreateForm />
    </div>
  );
}
