"use client";
import * as React from "react";
import { useRouter } from "next/navigation";

interface Shipment {
  id: string;
  carrier: string;
  trackingNumber: string | null;
  labelGeneratedAt: Date | string | null;
}

/**
 * Manual override for shipments where the carrier API failed beyond retry.
 * Uploads `{ shipmentId, trackingNumber, labelPdf }` as multipart/form-data
 * — Next.js parses it natively via `req.formData()` so no client-side
 * encoding is needed beyond setting the right body.
 */
export function ManualLabelForm({ shipments }: { shipments: Shipment[] }) {
  const router = useRouter();
  const failed = shipments.filter((s) => !s.labelGeneratedAt);
  const [shipmentId, setShipmentId] = React.useState(failed[0]?.id ?? "");
  const [trackingNumber, setTrackingNumber] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (failed.length === 0) {
    return (
      <p className="text-xs text-neutral-500">
        Every shipment has a generated label.
      </p>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !trackingNumber) {
      setError("Tracking number and PDF are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const orderId = window.location.pathname.split("/")[3];
      const fd = new FormData();
      fd.set("shipmentId", shipmentId);
      fd.set("trackingNumber", trackingNumber);
      fd.set("labelPdf", file);
      const res = await fetch(`/api/admin/orders/${orderId}/manual-label`, {
        method: "POST",
        body: fd,
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
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <label className="text-xs">
        Shipment
        <select
          value={shipmentId}
          onChange={(e) => setShipmentId(e.target.value)}
          className="mt-1 w-full border border-neutral-300 rounded px-2 py-1 text-sm"
        >
          {failed.map((s) => (
            <option key={s.id} value={s.id}>
              {s.carrier} · {s.id.slice(0, 8)}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        Tracking number
        <input
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
          className="mt-1 w-full border border-neutral-300 rounded px-2 py-1 text-sm"
        />
      </label>
      <label className="text-xs">
        Label PDF
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-1 w-full text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="self-start px-3 py-1.5 text-xs uppercase tracking-wider rounded bg-neutral-900 text-white disabled:opacity-50"
      >
        {busy ? "Uploading…" : "Save manual label"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}
