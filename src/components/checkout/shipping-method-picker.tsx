"use client";

import * as React from "react";
import { RadioGroup } from "@/components/ui/radio-group";
import type { Carrier } from "@/lib/schemas";

export interface ShippingMethodPickerProps {
  value: Carrier;
  onChange: (carrier: Carrier) => void;
}

export function ShippingMethodPicker({ value, onChange }: ShippingMethodPickerProps) {
  return (
    <RadioGroup
      name="shipping-method"
      value={value}
      onChange={(v) => onChange(v as Carrier)}
      options={[
        {
          value: "royal-mail",
          label: "Royal Mail — Free",
          description: "2–3 business days",
        },
        {
          value: "dhl",
          label: "DHL Worldwide",
          description: "8–10 business days · Calculated at checkout",
        },
      ]}
    />
  );
}
