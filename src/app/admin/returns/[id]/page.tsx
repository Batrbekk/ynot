import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db/client";
import { InspectionForm } from "./inspection-form";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

const TERMINAL = ["APPROVED", "REJECTED", "CANCELLED"] as const;

export default async function AdminReturnDetail({ params }: Params) {
  const { id } = await params;
  const ret = await prisma.return.findUnique({
    where: { id },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          shipFirstName: true,
          shipLastName: true,
          shipCountry: true,
          user: { select: { email: true } },
        },
      },
      items: { include: { orderItem: true } },
      refundEvents: true,
    },
  });
  if (!ret) notFound();
  const isTerminal = (TERMINAL as readonly string[]).includes(ret.status);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/returns" className="text-xs underline text-neutral-500">
          ← All returns
        </Link>
        <h2 className="text-2xl font-semibold mt-1">{ret.returnNumber}</h2>
        <div className="text-sm text-neutral-600">
          {ret.status} · {ret.reasonCategory} · order{" "}
          <Link href={`/admin/orders/${ret.order.id}`} className="underline">
            {ret.order.orderNumber}
          </Link>
        </div>
      </div>

      <section className="bg-white border border-neutral-200 rounded-lg p-5">
        <h3 className="font-semibold mb-3">Customer</h3>
        <div className="text-sm">
          {ret.order.shipFirstName} {ret.order.shipLastName} ·{" "}
          {ret.order.user?.email ?? "—"} · {ret.order.shipCountry}
        </div>
      </section>

      <section className="bg-white border border-neutral-200 rounded-lg p-5">
        <h3 className="font-semibold mb-3">Reason</h3>
        <p className="text-sm text-neutral-700 whitespace-pre-wrap">
          {ret.reason}
        </p>
      </section>

      <section className="bg-white border border-neutral-200 rounded-lg p-5">
        <h3 className="font-semibold mb-3">Inspection</h3>
        {isTerminal ? (
          <div className="text-sm space-y-2">
            <div>
              <strong>Status:</strong> {ret.status}
            </div>
            {ret.inspectionNotes && (
              <div>
                <strong>Notes:</strong>{" "}
                <span className="whitespace-pre-wrap">{ret.inspectionNotes}</span>
              </div>
            )}
            {ret.rejectionReason && (
              <div>
                <strong>Rejection reason:</strong> {ret.rejectionReason}
              </div>
            )}
            {ret.refundAmountCents !== null && (
              <div>
                <strong>Refunded:</strong> £
                {((ret.refundAmountCents ?? 0) / 100).toFixed(2)}
              </div>
            )}
            <ul className="mt-3 text-sm">
              {ret.items.map((i) => (
                <li key={i.id}>
                  {i.orderItem.productName} ({i.orderItem.size}) × {i.quantity}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <InspectionForm
            returnId={ret.id}
            items={ret.items.map((i) => ({
              id: i.id,
              productName: i.orderItem.productName,
              size: i.orderItem.size,
              quantity: i.quantity,
            }))}
          />
        )}
      </section>

      {ret.refundEvents.length > 0 && (
        <section className="bg-white border border-neutral-200 rounded-lg p-5">
          <h3 className="font-semibold mb-3">Refunds</h3>
          <ul className="text-sm space-y-1">
            {ret.refundEvents.map((r) => (
              <li key={r.id}>
                £{(r.amountCents / 100).toFixed(2)} — {r.reason}{" "}
                <span className="text-xs text-neutral-500">
                  ({new Date(r.createdAt).toISOString().slice(0, 10)})
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
