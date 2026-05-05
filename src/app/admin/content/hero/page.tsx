import * as React from 'react';
import Link from 'next/link';
import { prisma } from '@/server/db/client';
import { ActivateButton } from './_components/activate-button';

export const dynamic = 'force-dynamic';

export default async function AdminHeroPage(): Promise<React.ReactElement> {
  const heroes = await prisma.heroBlock.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Hero blocks</h2>
        <Link
          href="/admin/content/hero/new"
          className="px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded"
        >
          New hero
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600 text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2 w-24">Preview</th>
              <th className="text-left px-3 py-2">Eyebrow</th>
              <th className="text-left px-3 py-2">CTA</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Created</th>
              <th className="text-right px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {heroes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-neutral-500">
                  No hero blocks yet.
                </td>
              </tr>
            )}
            {heroes.map((h) => (
              <tr key={h.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                <td className="px-3 py-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={h.imageUrl}
                    alt=""
                    className="w-20 h-12 object-cover rounded"
                  />
                </td>
                <td className="px-3 py-2 font-medium">{h.eyebrow}</td>
                <td className="px-3 py-2 text-xs">
                  <span className="font-medium">{h.ctaLabel}</span>{' '}
                  <span className="font-mono text-neutral-600">→ {h.ctaHref}</span>
                </td>
                <td className="px-3 py-2">
                  {h.isActive ? (
                    <span className="inline-block px-2 py-0.5 text-xs rounded border bg-green-100 text-green-800 border-green-200">
                      Active
                    </span>
                  ) : (
                    <ActivateButton id={h.id} />
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-neutral-600">
                  {new Date(h.createdAt).toISOString().slice(0, 16).replace('T', ' ')}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/admin/content/hero/${h.id}`}
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
