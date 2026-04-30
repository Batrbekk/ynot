'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { PhoneInput } from '@/components/ui/phone-input';
import type { ShippingAddressT, QuoteResponseT } from '@/lib/schemas/checkout';
import { formatPrice } from '@/lib/format';

export interface ShippingFormProps {
  quote: QuoteResponseT | null;
  selectedMethodId: string | null;
  onAddressBlur: (address: ShippingAddressT) => void;
  onSelectMethod: (methodId: string) => void;
  onContinue: () => void;
}

const COUNTRIES = [
  { value: 'GB', label: 'United Kingdom' },
  { value: 'US', label: 'United States' },
  { value: 'FR', label: 'France' },
  { value: 'DE', label: 'Germany' },
  { value: 'IT', label: 'Italy' },
  { value: 'ES', label: 'Spain' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'AU', label: 'Australia' },
  { value: 'CA', label: 'Canada' },
  { value: 'JP', label: 'Japan' },
];

export function ShippingForm({ quote, selectedMethodId, onAddressBlur, onSelectMethod, onContinue }: ShippingFormProps) {
  const [email, setEmail] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [line1, setLine1] = React.useState('');
  const [line2, setLine2] = React.useState('');
  const [city, setCity] = React.useState('');
  const [postcode, setPostcode] = React.useState('');
  const [countryCode, setCountryCode] = React.useState('GB');

  function buildAddress(): ShippingAddressT | null {
    if (!email || !firstName || !lastName || !line1 || !city || !postcode) return null;
    return {
      email,
      firstName,
      lastName,
      line1,
      line2: line2 || null,
      city,
      postcode,
      countryCode,
      phone,
    };
  }

  function handleBlur() {
    const addr = buildAddress();
    if (addr) onAddressBlur(addr);
  }

  function handleCountryChange(cc: string) {
    setCountryCode(cc);
    // Trigger a quote refresh if address is complete
    if (email && firstName && lastName && line1 && city && postcode) {
      onAddressBlur({
        email,
        firstName,
        lastName,
        line1,
        line2: line2 || null,
        city,
        postcode,
        countryCode: cc,
        phone,
      });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onContinue();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-10">
      <fieldset className="flex flex-col gap-6">
        <legend className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-2">
          Contact
        </legend>
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={handleBlur}
          autoComplete="email"
          placeholder="email@example.com"
          required
        />
      </fieldset>

      <fieldset className="flex flex-col gap-6">
        <legend className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-2">
          Shipping information
        </legend>
        <div className="grid gap-6 md:grid-cols-2">
          <Input
            label="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            onBlur={handleBlur}
            autoComplete="given-name"
            required
          />
          <Input
            label="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            onBlur={handleBlur}
            autoComplete="family-name"
            required
          />
        </div>
        <PhoneInput label="Phone" value={phone} onChange={setPhone} />
        <Input
          label="Street address"
          value={line1}
          onChange={(e) => setLine1(e.target.value)}
          onBlur={handleBlur}
          autoComplete="address-line1"
          required
        />
        <Input
          label="Apartment, suite, etc. (optional)"
          value={line2}
          onChange={(e) => setLine2(e.target.value)}
          autoComplete="address-line2"
        />
        <div className="grid gap-6 md:grid-cols-3">
          <Input
            label="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onBlur={handleBlur}
            autoComplete="address-level2"
            required
          />
          <Input
            label="Postcode"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            onBlur={handleBlur}
            autoComplete="postal-code"
            required
          />
          <Select
            label="Country"
            value={countryCode}
            onChange={handleCountryChange}
            options={COUNTRIES}
          />
        </div>
      </fieldset>

      {quote && quote.methods.length > 0 && (
        <fieldset className="flex flex-col gap-4">
          <legend className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-2">
            Shipping method
          </legend>
          <ul className="space-y-3">
            {quote.methods.map((m) => (
              <li key={m.methodId}>
                <label className="flex items-center gap-4 cursor-pointer border border-border-light p-4 rounded-sm hover:border-foreground-secondary transition-colors">
                  <input
                    type="radio"
                    name="shippingMethod"
                    value={m.methodId}
                    checked={selectedMethodId === m.methodId}
                    onChange={() => onSelectMethod(m.methodId)}
                    className="accent-foreground-primary"
                  />
                  <div className="flex-1">
                    <p className="text-[13px] font-medium">{m.name}</p>
                    <p className="text-[12px] text-foreground-secondary">
                      {m.estimatedDaysMin}–{m.estimatedDaysMax} business days
                    </p>
                  </div>
                  <span className="text-[13px] font-medium">
                    {m.totalCents === 0 ? 'Free' : formatPrice(m.totalCents, 'GBP')}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <Button
        type="button"
        size="lg"
        fullWidth
        disabled={!selectedMethodId}
        onClick={selectedMethodId ? onContinue : undefined}
      >
        Continue to payment
      </Button>
    </form>
  );
}
