import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getForAdmin } from "@/server/orders/service";
import { MarkDespatchedForm } from "./mark-despatched-form";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * Print-and-despatch screen. Embeds the auth-gated label PDF in an iframe
 * (operator hits Cmd-P → A4) and offers per-shipment "mark as despatched"
 * buttons that drive `update-tracking` with status = IN_TRANSIT.
 *
 * One iframe per shipment with a stored label — multi-shipment orders print
 * each label as its own page.
 */
export default async function AdminShipPage({ params }: Params) {
  const { id } = await params;
  const order = await getForAdmin(id);
  if (!order) notFound();
  const printable = order.shipments.filter((s) => s.labelGeneratedAt);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/orders/${order.id}`} className="text-xs underline text-neutral-500">
          ← Back to order
        </Link>
        <h2 className="text-2xl font-semibold mt-1">Despatch {order.orderNumber}</h2>
      </div>

      {printable.length === 0 ? (
        <p className="text-sm text-neutral-500 bg-amber-50 border border-amber-200 rounded p-4">
          No labels are ready to print yet. Retry the carrier from the order
          detail screen, or upload a manual label.
        </p>
      ) : (
        <section className="bg-white border border-neutral-200 rounded-lg p-5">
          <h3 className="font-semibold mb-3">Mark as despatched</h3>
          <MarkDespatchedForm shipments={order.shipments} />
        </section>
      )}

      {printable.map((s) => (
        <section
          key={s.id}
          className="bg-white border border-neutral-200 rounded-lg p-5"
        >
          <h3 className="font-semibold mb-3">
            Label · {s.carrier} · {s.trackingNumber ?? "no tracking"}
          </h3>
          <iframe
            title={`Shipping label for ${s.id}`}
            src={`/api/admin/shipments/${s.id}/label.pdf`}
            className="w-full border border-neutral-300"
            style={{ height: "70vh" }}
          />
        </section>
      ))}
    </div>
  );
}
