"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface FindOrderFormProps {
  onSubmit: (orderNumber: string, contact: string) => void;
  error?: string;
}

export function FindOrderForm({ onSubmit, error }: FindOrderFormProps) {
  const [orderNumber, setOrderNumber] = React.useState("");
  const [contact, setContact] = React.useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber || !contact) return;
    onSubmit(orderNumber.trim(), contact.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-[480px]">
      <p className="text-[14px] text-foreground-secondary">
        Enter your order number and email or postcode to find your order and start the return process.
      </p>
      <Input
        label="Order number"
        placeholder="e.g. YNT-20260414-0029"
        value={orderNumber}
        onChange={(e) => setOrderNumber(e.target.value)}
        required
      />
      <Input
        label="Email address or postcode"
        placeholder="email@example.com"
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        error={error}
        required
      />
      <Button type="submit" size="lg" fullWidth>Find my order</Button>
      <p className="text-[12px] text-foreground-tertiary">
        Can&rsquo;t find your order number? Check your confirmation email or contact us.
      </p>
    </form>
  );
}
