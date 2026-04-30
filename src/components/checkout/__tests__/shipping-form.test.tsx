import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShippingForm } from '../shipping-form';

describe('ShippingForm', () => {
  it('calls onContinue when form submitted with method selected', async () => {
    const onAddressBlur = vi.fn();
    const onSelectMethod = vi.fn();
    const onContinue = vi.fn();

    const quote = {
      methods: [
        {
          methodId: 'rm-tracked',
          name: 'Royal Mail Tracked',
          carrier: 'ROYAL_MAIL' as const,
          baseRateCents: 0,
          dutiesCents: 0,
          totalCents: 0,
          estimatedDaysMin: 2,
          estimatedDaysMax: 5,
        },
      ],
    };

    render(
      <ShippingForm
        quote={quote}
        selectedMethodId="rm-tracked"
        onAddressBlur={onAddressBlur}
        onSelectMethod={onSelectMethod}
        onContinue={onContinue}
      />,
    );

    // Continue button should be enabled since selectedMethodId is set
    const btn = screen.getByRole('button', { name: /continue to payment/i });
    expect(btn).not.toBeDisabled();
    await userEvent.click(btn);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('disables Continue button when no method selected', () => {
    render(
      <ShippingForm
        quote={null}
        selectedMethodId={null}
        onAddressBlur={vi.fn()}
        onSelectMethod={vi.fn()}
        onContinue={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /continue to payment/i })).toBeDisabled();
  });
});
