import * as React from "react";
import Link from "next/link";
import { prisma } from "@/server/db/client";

export const dynamic = "force-dynamic";

/**
 * Operations dashboard. Each card is a snapshot count, deliberately small
 * Prisma queries so this page renders sub-100ms even with thousands of orders.
 *
 * Phase 5 cards (kept):
 * - Pending shipments: labels generated, not yet despatched.
 * - Returns awaiting inspection: customer parcel received, admin needs to
 *   approve / reject.
 * - Label-failure alerts: shipments at the give-up threshold (5 attempts).
 * - Tracking-stale alerts: live shipments with no carrier update in > 48h.
 *
 * Phase 7a cards (added):
 * - Drafts pending publish: Product.status='DRAFT' AND deletedAt=null.
 * - Low-stock alerts: ProductSize.stock <= 2.
 * - Active promos: PromoCode.isActive=true AND (expiresAt IS NULL OR
 *   expiresAt > now()).
 */
/**
 * Pulled out of the render body so the React-purity lint (which flags
 * Date.now / new Date() inside Server Components) stays happy. The dashboard
 * is `force-dynamic` so this is re-evaluated on every request anyway.
 */
function fortyEightHoursAgoSnapshot(): Date {
  return new Date(Date.now() - 48 * 3600 * 1000);
}

function nowSnapshot(): Date {
  return new Date();
}

export default async function AdminDashboard() {
  const fortyEightHoursAgo = fortyEightHoursAgoSnapshot();
  const now = nowSnapshot();
  const [
    pendingShipments,
    returnsAwaitingInspection,
    labelFailures,
    trackingStale,
    draftsPendingPublish,
    lowStockCount,
    activePromosCount,
  ] = await Promise.all([
    prisma.shipment.count({
      where: {
        labelGeneratedAt: { not: null },
        shippedAt: null,
        cancelledAt: null,
      },
    }),
    prisma.return.count({ where: { status: "RECEIVED" } }),
    prisma.shipment.count({
      where: { labelGeneratedAt: null, attemptCount: { gte: 5 } },
    }),
    prisma.shipment.count({
      where: {
        shippedAt: { not: null },
        deliveredAt: null,
        updatedAt: { lt: fortyEightHoursAgo },
      },
    }),
    prisma.product.count({
      where: { status: "DRAFT", deletedAt: null },
    }),
    prisma.productSize.count({
      where: { stock: { lte: 2 } },
    }),
    prisma.promoCode.count({
      where: {
        isActive: true,
        deletedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    }),
  ]);

  const cards = [
    {
      label: "Pending shipments",
      value: pendingShipments,
      href: "/admin/orders?status=PROCESSING",
      tone: "default" as const,
    },
    {
      label: "Returns awaiting inspection",
      value: returnsAwaitingInspection,
      href: "/admin/returns?status=RECEIVED",
      tone: returnsAwaitingInspection > 0 ? "warn" : ("default" as const),
    },
    {
      label: "Label-failure alerts",
      value: labelFailures,
      href: "/admin/orders?status=NEW",
      tone: labelFailures > 0 ? "danger" : ("default" as const),
    },
    {
      label: "Tracking-stale alerts (>48h)",
      value: trackingStale,
      href: "/admin/orders?status=SHIPPED",
      tone: trackingStale > 0 ? "warn" : ("default" as const),
    },
    {
      label: "Drafts pending publish",
      value: draftsPendingPublish,
      href: "/admin/catalog/products?status=DRAFT",
      tone: draftsPendingPublish > 0 ? "warn" : ("default" as const),
    },
    {
      label: "Low-stock alerts",
      value: lowStockCount,
      href: "/admin/catalog/products",
      tone: lowStockCount > 0 ? "warn" : ("default" as const),
    },
    {
      label: "Active promos",
      value: activePromosCount,
      href: "/admin/marketing/promos?status=active",
      tone: "default" as const,
    },
  ];

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Dashboard</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={
              "block rounded-lg border p-5 bg-white hover:shadow transition-shadow " +
              (c.tone === "danger"
                ? "border-red-300"
                : c.tone === "warn"
                  ? "border-amber-300"
                  : "border-neutral-200")
            }
          >
            <div className="text-xs uppercase tracking-wider text-neutral-500">
              {c.label}
            </div>
            <div
              className={
                "mt-2 text-3xl font-semibold " +
                (c.tone === "danger"
                  ? "text-red-600"
                  : c.tone === "warn"
                    ? "text-amber-600"
                    : "text-neutral-900")
              }
            >
              {c.value}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
