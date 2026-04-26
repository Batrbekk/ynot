"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CardInput, type CardValue } from "@/components/ui/card-input";
import { Button } from "@/components/ui/button";

export interface PaymentFormProps {
  totalLabel: string;
  onPay: () => void;
}

export function PaymentForm({ totalLabel, onPay }: PaymentFormProps) {
  const [card, setCard] = React.useState<CardValue>({
    number: "",
    expiry: "",
    cvc: "",
  });
  const [nameOnCard, setNameOnCard] = React.useState("");
  const [billingSame, setBillingSame] = React.useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!card.number || !card.expiry || !card.cvc || !nameOnCard) return;
    onPay();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <fieldset className="flex flex-col gap-6">
        <legend className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-2">
          Payment details
        </legend>
        <CardInput value={card} onChange={setCard} />
        <Input
          label="Name on card"
          value={nameOnCard}
          onChange={(e) => setNameOnCard(e.target.value)}
          autoComplete="cc-name"
          placeholder="Full name as on card"
          required
        />
      </fieldset>

      <Checkbox
        label="Billing address same as shipping"
        checked={billingSame}
        onChange={(e) => setBillingSame(e.target.checked)}
      />

      <Button type="submit" size="lg" fullWidth>
        Pay {totalLabel}
      </Button>

      <p className="text-center text-[11px] uppercase tracking-[0.2em] text-foreground-tertiary">
        256-bit SSL encrypted payment
      </p>
    </form>
  );
}
