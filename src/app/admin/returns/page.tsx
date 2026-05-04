import * as React from "react";
import Link from "next/link";
import type { ReturnStatus } from "@prisma/client";
import { prisma } from "@/server/db/client";

export const dynamic = "force-dynamic";

const STATUSES: ReturnStatus[] = [
  "REQUESTED",
  "AWAITING_PARCEL",
  "RECEIVED",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
];

interface SP {
  searchParams: Promise<{ status?: string }>;
}

export default async function AdminReturnsPage({ searchParams }: SP) {
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as ReturnStatus)
    ? (sp.status as ReturnStatus)
    : undefined;

  const returns = await prisma.return.findMany({
    where: status ? { status } : undefined,
    take: 100,
    orderBy: { createdAt: "desc" },
    include: {
      order: { select: { orderNumber: true, shipFirstName: true, shipLastName: true } },
      items: true,
    },
  });

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Returns</h2>
      <form method="get" className="mb-4 flex gap-3 items-end text-sm">
        <label className="flex flex-col">
          <span className="text-xs text-neutral-600 mb-1">Status</span>
          <select
            name="status"
            defaultValue={status ?? ""}
            className="border border-neutral-300 rounded px-2 py-1 bg-white"
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="h-[34px] px-4 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded"
        >
          Filter
        </button>
      </form>

      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600 text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2">Return</th>
              <th className="text-left px-3 py-2">Order</th>
              <th className="text-left px-3 py-2">Customer</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2">Items</th>
              <th className="text-left px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {returns.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-neutral-500">
                  No returns match.
                </td>
              </tr>
            )}
            {returns.map((r) => (
              <tr key={r.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                <td className="px-3 py-2 font-mono">
                  <Link href={`/admin/returns/${r.id}`} className="underline">
                    {r.returnNumber}
                  </Link>
                </td>
                <td className="px-3 py-2 font-mono">{r.order.orderNumber}</td>
                <td className="px-3 py-2">
                  {r.order.shipFirstName} {r.order.shipLastName}
                </td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2 text-right">{r.items.length}</td>
                <td className="px-3 py-2 text-xs text-neutral-600">
                  {new Date(r.createdAt).toISOString().slice(0, 16).replace("T", " ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
