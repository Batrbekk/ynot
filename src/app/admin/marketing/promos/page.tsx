import * as React from 'react';
import Link from 'next/link';
import { prisma } from '@/server/db/client';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

type Status = 'all' | 'active' | 'expired' | 'deactivated';

const STATUSES: ReadonlyArray<{ value: Status; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'deactivated', label: 'Deactivated' },
  { value: 'all', label: 'All' },
];

/**
 * Resolves the WHERE clause for a given filter. We always exclude
 * `deletedAt != null` rows because hard-tombstones are reserved for an
 * out-of-band cleanup process — the admin UI should never need to show
 * them.
 */
function whereForStatus(status: Status, now: Date): Prisma.PromoCodeWhereInput {
  switch (status) {
    case 'active':
      return {
        isActive: true,
        deletedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      };
    case 'expired':
      return { deletedAt: null, expiresAt: { lt: now } };
    case 'deactivated':
      return { isActive: false, deletedAt: null };
    case 'all':
    default:
      return { deletedAt: null };
  }
}

function formatDiscount(type: 'FIXED' | 'PERCENT', value: number): string {
  return type === 'FIXED' ? `£${(value / 100).toFixed(2)}` : `${value}%`;
}

function formatExpiry(d: Date | null): string {
  if (!d) return '—';
  return d.toISOString().slice(0, 10);
}

function badgeFor(promo: {
  isActive: boolean;
  expiresAt: Date | null;
}): { label: string; cls: string } {
  if (!promo.isActive) {
    return {
      label: 'Deactivated',
      cls: 'bg-neutral-200 text-neutral-700 border-neutral-300',
    };
  }
  if (promo.expiresAt && promo.expiresAt < new Date()) {
    return {
      label: 'Expired',
      cls: 'bg-amber-100 text-amber-800 border-amber-200',
    };
  }
  return {
    label: 'Active',
    cls: 'bg-green-100 text-green-800 border-green-200',
  };
}

interface Ctx {
  searchParams: Promise<{ status?: string }>;
}

export default async function AdminPromosPage(ctx: Ctx): Promise<React.ReactElement> {
  const sp = await ctx.searchParams;
  const status: Status = ((): Status => {
    const raw = sp.status;
    if (raw === 'all' || raw === 'expired' || raw === 'deactivated' || raw === 'active') {
      return raw;
    }
    return 'active';
  })();

  const items = await prisma.promoCode.findMany({
    where: whereForStatus(status, new Date()),
    orderBy: [{ createdAt: 'desc' }],
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Promo codes</h2>
        <Link
          href="/admin/marketing/promos/new"
          className="px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded"
        >
          New promo
        </Link>
      </div>

      <div className="flex gap-2 mb-4 text-xs uppercase tracking-wider">
        {STATUSES.map((s) => {
          const active = s.value === status;
          return (
            <Link
              key={s.value}
              href={s.value === 'active' ? '/admin/marketing/promos' : `/admin/marketing/promos?status=${s.value}`}
              className={`px-3 py-1 rounded border ${
                active
                  ? 'bg-neutral-900 text-white border-neutral-900'
                  : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
              }`}
            >
              {s.label}
            </Link>
          );
        })}
      </div>

      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600 text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2">Code</th>
              <th className="text-left px-3 py-2">Discount</th>
              <th className="text-left px-3 py-2">Usage</th>
              <th className="text-left px-3 py-2">Expires</th>
              <th className="text-left px-3 py-2 w-28">Status</th>
              <th className="text-right px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-neutral-500">
                  No promos in this view.
                </td>
              </tr>
            )}
            {items.map((p) => {
              const badge = badgeFor(p);
              const usage = `${p.usageCount} / ${p.usageLimit ?? '∞'}`;
              return (
                <tr key={p.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                  <td className="px-3 py-2 font-mono">{p.code}</td>
                  <td className="px-3 py-2">{formatDiscount(p.discountType, p.discountValue)}</td>
                  <td className="px-3 py-2 text-neutral-700">{usage}</td>
                  <td className="px-3 py-2 text-neutral-700">{formatExpiry(p.expiresAt)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded border ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/admin/marketing/promos/${p.id}`}
                      className="text-neutral-900 underline text-xs"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
