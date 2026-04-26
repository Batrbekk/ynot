"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { CheckoutProgress } from "@/components/checkout/checkout-progress";
import { ShippingForm, type ShippingFormSubmit } from "@/components/checkout/shipping-form";
import { OrderSummaryCard } from "@/components/checkout/order-summary-card";
import { useCheckoutStore } from "@/lib/stores/checkout-store";
import { useCartStore } from "@/lib/stores/cart-store";

export default function CheckoutShippingPage() {
  const router = useRouter();
  const setShipping = useCheckoutStore((s) => s.setShipping);
  const itemCount = useCartStore((s) => s.itemCount());

  React.useEffect(() => {
    if (itemCount === 0) router.push("/");
  }, [itemCount, router]);

  const onSubmit = (data: ShippingFormSubmit) => {
    setShipping(data.address, data.method);
    router.push("/checkout/payment");
  };

  return (
    <Section padding="md">
      <Container size="wide">
        <CheckoutProgress current={1} />
        <div className="mt-12 grid gap-12 md:grid-cols-[1fr_360px]">
          <ShippingForm onSubmit={onSubmit} />
          <OrderSummaryCard />
        </div>
      </Container>
    </Section>
  );
}
