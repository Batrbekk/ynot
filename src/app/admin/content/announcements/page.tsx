import * as React from 'react';
import Link from 'next/link';
import { prisma } from '@/server/db/client';

export const dynamic = 'force-dynamic';

export default async function AdminAnnouncementsPage(): Promise<React.ReactElement> {
  const items = await prisma.announcementMessage.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Announcements</h2>
        <Link
          href="/admin/content/announcements/new"
          className="px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded"
        >
          New announcement
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600 text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2">Text</th>
              <th className="text-right px-3 py-2 w-24">Sort</th>
              <th className="text-left px-3 py-2 w-24">Status</th>
              <th className="text-right px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-neutral-500">
                  No announcements yet.
                </td>
              </tr>
            )}
            {items.map((a) => (
              <tr key={a.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                <td className="px-3 py-2">{a.text}</td>
                <td className="px-3 py-2 text-right text-xs text-neutral-600">
                  {a.sortOrder}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block px-2 py-0.5 text-xs rounded border ${
                      a.isActive
                        ? 'bg-green-100 text-green-800 border-green-200'
                        : 'bg-neutral-200 text-neutral-700 border-neutral-300'
                    }`}
                  >
                    {a.isActive ? 'Active' : 'Hidden'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/admin/content/announcements/${a.id}`}
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
