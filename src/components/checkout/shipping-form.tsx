"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import { ShippingMethodPicker } from "./shipping-method-picker";
import type { Address, Carrier } from "@/lib/schemas";

export interface ShippingFormSubmit {
  address: Address;
  method: Carrier;
}

export interface ShippingFormProps {
  defaults?: Partial<Address>;
  defaultMethod?: Carrier;
  onSubmit: (data: ShippingFormSubmit) => void;
}

const COUNTRIES = [
  { value: "GB", label: "United Kingdom" },
  { value: "US", label: "United States" },
  { value: "FR", label: "France" },
  { value: "DE", label: "Germany" },
];

export function ShippingForm({ defaults, defaultMethod = "royal-mail", onSubmit }: ShippingFormProps) {
  const [firstName, setFirstName] = React.useState(defaults?.firstName ?? "");
  const [lastName, setLastName] = React.useState(defaults?.lastName ?? "");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState(defaults?.phone ?? "");
  const [line1, setLine1] = React.useState(defaults?.line1 ?? "");
  const [city, setCity] = React.useState(defaults?.city ?? "");
  const [postcode, setPostcode] = React.useState(defaults?.postcode ?? "");
  const [country, setCountry] = React.useState(defaults?.country ?? "GB");
  const [method, setMethod] = React.useState<Carrier>(defaultMethod);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !line1 || !city || !postcode) return;
    onSubmit({
      address: {
        firstName,
        lastName,
        line1,
        line2: null,
        city,
        postcode,
        country,
        phone,
      },
      method,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-10">
      <fieldset className="flex flex-col gap-6">
        <legend className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-2">
          Shipping information
        </legend>
        <div className="grid gap-6 md:grid-cols-2">
          <Input
            label="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            required
          />
          <Input
            label="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
            required
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="email@example.com"
            required
          />
          <PhoneInput label="Phone" value={phone} onChange={setPhone} />
        </div>
        <Input
          label="Street address"
          value={line1}
          onChange={(e) => setLine1(e.target.value)}
          autoComplete="address-line1"
          required
        />
        <div className="grid gap-6 md:grid-cols-3">
          <Input
            label="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            autoComplete="address-level2"
            required
          />
          <Input
            label="Postcode"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            autoComplete="postal-code"
            required
          />
          <Select
            label="Country"
            value={country}
            onChange={setCountry}
            options={COUNTRIES}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-2">
          Shipping method
        </legend>
        <ShippingMethodPicker value={method} onChange={setMethod} />
      </fieldset>

      <Button type="submit" size="lg" fullWidth>
        Continue to payment
      </Button>
    </form>
  );
}
