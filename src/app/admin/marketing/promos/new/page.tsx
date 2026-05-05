import * as React from 'react';
import Link from 'next/link';
import { PromoCreateForm } from './_components/promo-create-form';

export const dynamic = 'force-dynamic';

export default function AdminPromoNewPage(): React.ReactElement {
  return (
    <div className="max-w-2xl">
      <div className="mb-6 text-sm">
        <Link href="/admin/marketing/promos" className="text-neutral-600 underline">
          ← Back to promos
        </Link>
      </div>
      <h2 className="text-2xl font-semibold mb-6">New promo</h2>
      <PromoCreateForm />
    </div>
  );
}
