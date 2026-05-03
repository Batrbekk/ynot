"use client";
import * as React from "react";
import { useRouter } from "next/navigation";

interface ReturnItem {
  id: string;
  productName: string;
  size: string;
  quantity: number;
}

interface InspectionFormProps {
  returnId: string;
  items: ReturnItem[];
}

/**
 * Per-item Acceptable / Rejected toggle. Approve sends the accepted-id list
 * + inspection notes to /approve; Reject sends rejection reason + notes to
 * /reject. Disabled once the return is in a terminal status — the parent
 * page renders this only for inspectable returns.
 */
export function InspectionForm({ returnId, items }: InspectionFormProps) {
  const router = useRouter();
  const [accepted, setAccepted] = React.useState<Record<string, boolean>>(
    () => Object.fromEntries(items.map((i) => [i.id, true])),
  );
  const [notes, setNotes] = React.useState("");
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [busy, setBusy] = React.useState<"approve" | "reject" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function approve() {
    const acceptedIds = items.filter((i) => accepted[i.id]).map((i) => i.id);
    if (acceptedIds.length === 0) {
      setError("Approve requires at least one accepted item.");
      return;
    }
    if (!window.confirm(`Approve ${acceptedIds.length} item(s) and refund?`)) return;
    setBusy("approve");
    setError(null);
    try {
      const res = await fetch(`/api/admin/returns/${returnId}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          acceptedItemIds: acceptedIds,
          inspectionNotes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        setError((await res.text().catch(() => "")) || `Failed (${res.status})`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    if (rejectionReason.trim().length < 3) {
      setError("Rejection reason is required.");
      return;
    }
    if (notes.trim().length < 3) {
      setError("Inspection notes are required when rejecting.");
      return;
    }
    if (!window.confirm("Reject this return? No refund will be issued.")) return;
    setBusy("reject");
    setError(null);
    try {
      const res = await fetch(`/api/admin/returns/${returnId}/reject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rejectionReason: rejectionReason.trim(),
          inspectionNotes: notes.trim(),
        }),
      });
      if (!res.ok) {
        setError((await res.text().catch(() => "")) || `Failed (${res.status})`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-neutral-500">
          <tr>
            <th className="text-left">Item</th>
            <th className="text-right">Qty</th>
            <th className="text-center w-32">Disposition</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-t border-neutral-100">
              <td className="py-1">
                {it.productName}{" "}
                <span className="text-neutral-500">({it.size})</span>
              </td>
              <td className="py-1 text-right">{it.quantity}</td>
              <td className="py-1 text-center">
                <label className="inline-flex items-center gap-1 mr-3">
                  <input
                    type="radio"
                    name={`disp-${it.id}`}
                    checked={accepted[it.id] === true}
                    onChange={() => setAccepted((a) => ({ ...a, [it.id]: true }))}
                  />
                  <span className="text-xs">Accept</span>
                </label>
                <label className="inline-flex items-center gap-1">
                  <input
                    type="radio"
                    name={`disp-${it.id}`}
                    checked={accepted[it.id] === false}
                    onChange={() => setAccepted((a) => ({ ...a, [it.id]: false }))}
                  />
                  <span className="text-xs">Reject</span>
                </label>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <label className="block text-xs">
        Inspection notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-1 w-full border border-neutral-300 rounded px-2 py-1 text-sm"
        />
      </label>

      <label className="block text-xs">
        Rejection reason (required to reject the entire return)
        <input
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
          className="mt-1 w-full border border-neutral-300 rounded px-2 py-1 text-sm"
          placeholder="Items damaged in transit / outside policy"
        />
      </label>

      <div className="flex gap-3 items-center">
        <button
          type="button"
          disabled={busy !== null}
          onClick={approve}
          className="px-4 py-2 text-xs uppercase tracking-wider rounded bg-emerald-600 text-white disabled:opacity-50"
        >
          {busy === "approve" ? "Approving…" : "Approve & refund"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={reject}
          className="px-4 py-2 text-xs uppercase tracking-wider rounded bg-red-600 text-white disabled:opacity-50"
        >
          {busy === "reject" ? "Rejecting…" : "Reject"}
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}
