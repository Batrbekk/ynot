"use client";

import * as React from "react";
import { Input } from "./input";

export interface CardValue {
  number: string;
  expiry: string;
  cvc: string;
}

export interface CardInputProps {
  value: CardValue;
  onChange: (value: CardValue) => void;
}

export function CardInput({ value, onChange }: CardInputProps) {
  const set = <K extends keyof CardValue>(key: K, v: string) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="col-span-2">
        <Input
          label="Card number"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="1234 5678 9012 3456"
          value={value.number}
          onChange={(e) => set("number", e.target.value)}
        />
      </div>
      <Input
        label="Expiry date"
        autoComplete="cc-exp"
        placeholder="MM / YY"
        value={value.expiry}
        onChange={(e) => set("expiry", e.target.value)}
      />
      <Input
        label="CVC"
        inputMode="numeric"
        autoComplete="cc-csc"
        placeholder="123"
        value={value.cvc}
        onChange={(e) => set("cvc", e.target.value)}
      />
    </div>
  );
}
