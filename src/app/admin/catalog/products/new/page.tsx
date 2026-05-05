import * as React from 'react';
import Link from 'next/link';
import { ProductCreateForm } from './_components/product-create-form';

export const dynamic = 'force-dynamic';

export default function AdminProductNewPage(): React.ReactElement {
  return (
    <div className="max-w-2xl">
      <div className="mb-6 text-sm">
        <Link href="/admin/catalog/products" className="text-neutral-600 underline">
          ← Back to products
        </Link>
      </div>
      <h2 className="text-2xl font-semibold mb-6">New product</h2>
      <ProductCreateForm />
    </div>
  );
}
