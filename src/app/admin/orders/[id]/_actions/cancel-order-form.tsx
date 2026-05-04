"use client";
import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * Two-step cancel: reason input → confirm → POST /cancel.
 *
 * The endpoint refuses cancel from non-cancellable statuses (SHIPPED,
 * DELIVERED, RETURNED, CANCELLED) — we surface those errors inline rather
 * than disabling the button so the operator sees the policy text.
 */
export function CancelOrderForm() {
  const router = useRouter();
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 3) {
      setError("Reason is required.");
      return;
    }
    if (!window.confirm("Cancel this order and refund the customer?")) return;
    setBusy(true);
    setError(null);
    try {
      const orderId = window.location.pathname.split("/")[3];
      const res = await fetch(`/api/admin/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
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
        Reason
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 w-full border border-neutral-300 rounded px-2 py-1 text-sm"
          placeholder="customer request / fraud / out of stock"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="self-start px-3 py-1.5 text-xs uppercase tracking-wider rounded bg-red-600 text-white disabled:opacity-50"
      >
        {busy ? "Cancelling…" : "Cancel order"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}
