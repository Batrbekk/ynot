"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { CheckoutProgress } from "@/components/checkout/checkout-progress";
import { PaymentForm } from "@/components/checkout/payment-form";
import { OrderSummaryCard } from "@/components/checkout/order-summary-card";
import { useCheckoutStore } from "@/lib/stores/checkout-store";
import { useCartStore } from "@/lib/stores/cart-store";
import { formatPrice } from "@/lib/format";

export default function CheckoutPaymentPage() {
  const router = useRouter();
  const subtotal = useCartStore((s) => s.subtotal());
  const itemCount = useCartStore((s) => s.itemCount());
  const shippingAddress = useCheckoutStore((s) => s.shippingAddress);
  const placeOrder = useCheckoutStore((s) => s.placeOrder);

  React.useEffect(() => {
    if (itemCount === 0) {
      router.push("/");
      return;
    }
    if (!shippingAddress) {
      router.push("/checkout/shipping");
    }
  }, [itemCount, shippingAddress, router]);

  const onPay = () => {
    const id = placeOrder();
    if (id) router.push(`/checkout/success/${id}`);
  };

  return (
    <Section padding="md">
      <Container size="wide">
        <CheckoutProgress current={2} />
        <div className="mt-12 grid gap-12 md:grid-cols-[1fr_360px]">
          <PaymentForm totalLabel={formatPrice(subtotal, "GBP")} onPay={onPay} />
          <OrderSummaryCard />
        </div>
      </Container>
    </Section>
  );
}
