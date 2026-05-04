"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Display } from "@/components/ui/typography";
import type { ReturnReasonT } from "@/lib/schemas/return";

export interface ReturnSubmitProps {
  /** Prisma `Order.id` (cuid) — sent as POST /api/returns `orderId`. */
  orderId: string;
  /** Display label (orderNumber) used in copy only. */
  orderNumber: string;
  items: { orderItemId: string; quantity: number }[];
  reason: string;
  reasonCategory?: ReturnReasonT;
}

/**
 * Final step of the /initiate-return wizard. Renders a confirmation summary
 * and a "Submit return" button that POSTs to /api/returns. On success,
 * navigates to /initiate-return/success?id={returnNumber}; on error renders
 * an inline alert with the server's message.
 */
export function ReturnSubmit({
  orderId,
  orderNumber,
  items,
  reason,
  reasonCategory = "OTHER",
}: ReturnSubmitProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderId, items, reason, reasonCategory }),
      });
      const data = (await res.json().catch(() => null)) as
        | { returnId: string; returnNumber: string; error?: string; message?: string }
        | null;
      if (!res.ok) {
        const msg =
          data?.message ??
          data?.error ??
          `We couldn't submit your return (status ${res.status}). Please try again.`;
        setError(msg);
        return;
      }
      const returnNumber = data?.returnNumber ?? data?.returnId ?? "";
      router.push(
        `/initiate-return/success?id=${encodeURIComponent(returnNumber)}`,
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Network error — please check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-[640px] text-center mx-auto">
      <Display level="md" as="h1">
        Confirm your return
      </Display>
      <p className="text-[14px] text-foreground-secondary">
        You&rsquo;re returning {items.length}{" "}
        {items.length === 1 ? "item" : "items"} from order{" "}
        <strong>#{orderNumber}</strong>. Once you confirm, we&rsquo;ll email you
        a pre-paid label and instructions.
      </p>

      {error && (
        <p
          role="alert"
          className="text-[13px] text-error border border-error/40 bg-error/5 p-3"
        >
          {error}
        </p>
      )}

      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={submitting || items.length === 0}
        >
          {submitting ? "Submitting…" : "Submit return"}
        </Button>
      </div>
    </div>
  );
}
