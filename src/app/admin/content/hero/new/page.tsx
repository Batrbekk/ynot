import * as React from 'react';
import Link from 'next/link';
import { HeroCreateForm } from './_components/hero-create-form';

export const dynamic = 'force-dynamic';

export default function AdminHeroNewPage(): React.ReactElement {
  return (
    <div className="max-w-2xl">
      <div className="mb-6 text-sm">
        <Link href="/admin/content/hero" className="text-neutral-600 underline">
          ← Back to hero blocks
        </Link>
      </div>
      <h2 className="text-2xl font-semibold mb-6">New hero block</h2>
      <HeroCreateForm />
    </div>
  );
}
