import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Display } from "@/components/ui/typography";

export interface ReturnConfirmationProps {
  orderId: string;
  email: string;
  itemCount: number;
}

export function ReturnConfirmation({ orderId, email, itemCount }: ReturnConfirmationProps) {
  return (
    <div className="flex flex-col gap-8 max-w-[640px] text-center mx-auto">
      <Display level="md" as="h1">Return submitted</Display>
      <p className="text-[14px] text-foreground-secondary">
        We&rsquo;ve received your return request for order <strong>#{orderId}</strong> ({itemCount} {itemCount === 1 ? "item" : "items"}).
        A pre-paid return label and instructions have been sent to <strong>{email || "your email"}</strong>.
      </p>

      <div className="border border-border-light p-6 text-left">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.2em] text-foreground-secondary mb-3">
          Next steps
        </h2>
        <ol className="flex flex-col gap-2 text-[14px] text-foreground-primary list-decimal pl-5">
          <li>Print the pre-paid label from the email we sent.</li>
          <li>Pack the items in their original packaging with tags attached.</li>
          <li>Drop off at any Royal Mail post office (UK) or DHL ServicePoint (worldwide).</li>
          <li>You&rsquo;ll receive a refund within 5–7 business days of us receiving the return.</li>
        </ol>
      </div>

      <div className="flex justify-center">
        <Link href="/">
          <Button size="lg">Continue shopping</Button>
        </Link>
      </div>
    </div>
  );
}
