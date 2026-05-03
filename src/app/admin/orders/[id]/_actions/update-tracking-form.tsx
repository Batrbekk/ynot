"use client";
import * as React from "react";
import { useRouter } from "next/navigation";

interface Shipment {
  id: string;
  trackingNumber: string | null;
  carrier: string;
  shippedAt: Date | string | null;
}

const STATUSES = [
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "EXCEPTION",
] as const;

/**
 * Manual tracking-status override. Drives `POST /update-tracking`, which
 * appends a ShipmentEvent and (if status === DELIVERED) flips
 * `Shipment.deliveredAt` plus runs the order-state-machine reconciliation.
 */
export function UpdateTrackingForm({ shipments }: { shipments: Shipment[] }) {
  const router = useRouter();
  const eligible = shipments.filter((s) => s.shippedAt && s.trackingNumber);
  const [shipmentId, setShipmentId] = React.useState(eligible[0]?.id ?? "");
  const [status, setStatus] = React.useState<typeof STATUSES[number]>("DELIVERED");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (eligible.length === 0) {
    return (
      <p className="text-xs text-neutral-500">
        No despatched shipments to update.
      </p>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const orderId = window.location.pathname.split("/")[3];
      const res = await fetch(`/api/admin/orders/${orderId}/update-tracking`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shipmentId, status }),
      });
      if (!res.ok) {
        setError((await res.text().catch(() => "")) || `Failed (${res.status})`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap gap-2 items-end">
      <label className="flex flex-col text-xs">
        Shipment
        <select
          value={shipmentId}
          onChange={(e) => setShipmentId(e.target.value)}
          className="mt-1 border border-neutral-300 rounded px-2 py-1"
        >
          {eligible.map((s) => (
            <option key={s.id} value={s.id}>
              {s.carrier} · {s.trackingNumber}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs">
        Status
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof STATUSES[number])}
          className="mt-1 border border-neutral-300 rounded px-2 py-1"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={busy}
        className="px-3 py-1.5 text-xs uppercase tracking-wider rounded bg-neutral-900 text-white disabled:opacity-50"
      >
        {busy ? "Saving…" : "Update"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}
