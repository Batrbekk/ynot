"use client";
import * as React from "react";
import { useRouter } from "next/navigation";

interface Shipment {
  id: string;
  carrier: string;
  trackingNumber: string | null;
  shippedAt: Date | string | null;
  labelGeneratedAt: Date | string | null;
}

/**
 * Mark a shipment as despatched. Posts to /update-tracking with status =
 * IN_TRANSIT, which sets `shippedAt` (if not already set), appends a
 * ShipmentEvent, and sends the OrderShipped email via the order state machine.
 */
export function MarkDespatchedForm({ shipments }: { shipments: Shipment[] }) {
  const router = useRouter();
  const eligible = shipments.filter(
    (s) => s.labelGeneratedAt && !s.shippedAt && s.trackingNumber,
  );
  const [shipmentId, setShipmentId] = React.useState(eligible[0]?.id ?? "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (eligible.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        Every printed label has already been despatched.
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
        body: JSON.stringify({ shipmentId, status: "IN_TRANSIT" }),
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
      <button
        type="submit"
        disabled={busy}
        className="px-3 py-1.5 text-xs uppercase tracking-wider rounded bg-neutral-900 text-white disabled:opacity-50"
      >
        {busy ? "Marking…" : "Mark as despatched"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}
