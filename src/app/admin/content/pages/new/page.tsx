import * as React from 'react';
import Link from 'next/link';
import { StaticPageCreateForm } from './_components/static-page-create-form';

export const dynamic = 'force-dynamic';

export default function AdminStaticPageNewPage(): React.ReactElement {
  return (
    <div className="max-w-2xl">
      <div className="mb-6 text-sm">
        <Link href="/admin/content/pages" className="text-neutral-600 underline">
          ← Back to pages
        </Link>
      </div>
      <h2 className="text-2xl font-semibold mb-6">New static page</h2>
      <StaticPageCreateForm />
    </div>
  );
}
