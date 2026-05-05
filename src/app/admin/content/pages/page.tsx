import * as React from 'react';
import Link from 'next/link';
import { prisma } from '@/server/db/client';

export const dynamic = 'force-dynamic';

export default async function AdminStaticPagesPage(): Promise<React.ReactElement> {
  const pages = await prisma.staticPage.findMany({
    orderBy: { updatedAt: 'desc' },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Static pages</h2>
        <Link
          href="/admin/content/pages/new"
          className="px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded"
        >
          New page
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600 text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2">Title</th>
              <th className="text-left px-3 py-2">Slug</th>
              <th className="text-left px-3 py-2">Updated</th>
              <th className="text-right px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {pages.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-neutral-500">
                  No pages yet.
                </td>
              </tr>
            )}
            {pages.map((p) => (
              <tr key={p.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                <td className="px-3 py-2 font-medium">{p.title}</td>
                <td className="px-3 py-2 font-mono text-xs text-neutral-600">{p.slug}</td>
                <td className="px-3 py-2 text-xs text-neutral-600">
                  {new Date(p.updatedAt).toISOString().slice(0, 16).replace('T', ' ')}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/admin/content/pages/${p.id}`}
                    className="text-neutral-900 underline text-xs"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
