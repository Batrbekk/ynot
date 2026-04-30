'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { CheckoutProgress } from '@/components/checkout/checkout-progress';
import { ShippingForm } from '@/components/checkout/shipping-form';
import { OrderSummaryCard } from '@/components/checkout/order-summary-card';
import { useCheckoutStore } from '@/lib/stores/checkout-store';
import { useCartStore } from '@/lib/stores/cart-store';
import { QuoteResponse, type ShippingAddressT } from '@/lib/schemas/checkout';

export default function CheckoutShippingPage() {
  const router = useRouter();
  const cart = useCartStore((s) => s.snapshot);
  const hydrate = useCartStore((s) => s.hydrate);
  const setAddress = useCheckoutStore((s) => s.setAddress);
  const setQuote = useCheckoutStore((s) => s.setQuote);
  const quote = useCheckoutStore((s) => s.quote);
  const selectMethod = useCheckoutStore((s) => s.selectMethod);
  const selectedMethodId = useCheckoutStore((s) => s.selectedMethodId);

  React.useEffect(() => { hydrate(); }, [hydrate]);
  React.useEffect(() => {
    if (cart && cart.items.length === 0) router.push('/');
  }, [cart, router]);

  async function handleQuote(address: ShippingAddressT) {
    const res = await fetch('/api/checkout/quote', {
      method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address }),
    });
    if (!res.ok) return;
    const json = QuoteResponse.parse(await res.json());
    setQuote(json);
    setAddress(address);
  }

  function handleContinue() {
    if (!selectedMethodId) return;
    router.push('/checkout/payment');
  }

  return (
    <Section padding="md">
      <Container size="wide">
        <CheckoutProgress current={1} />
        <div className="mt-12 grid gap-12 md:grid-cols-[1fr_360px]">
          <ShippingForm
            quote={quote}
            selectedMethodId={selectedMethodId}
            onAddressBlur={handleQuote}
            onSelectMethod={selectMethod}
            onContinue={handleContinue}
          />
          <OrderSummaryCard />
        </div>
      </Container>
    </Section>
  );
}
