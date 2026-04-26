"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { ConfirmationLayout } from "@/components/checkout/confirmation-layout";
import { Button } from "@/components/ui/button";
import { useCheckoutStore } from "@/lib/stores/checkout-store";
import Link from "next/link";

export default function CheckoutSuccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
  const order = useCheckoutStore((s) => s.getPlacedOrderById(id));

  React.useEffect(() => {
    // No-op: just to mark client mount; rendering handled below
  }, [router]);

  if (!order) {
    return (
      <Section padding="md">
        <Container size="narrow" className="text-center">
          <h1 className="font-heading text-[36px] mb-4">Order not found</h1>
          <p className="text-[14px] text-foreground-secondary mb-8">
            We couldn&rsquo;t find the order with id <code>{id}</code>. It may have been completed in another session.
          </p>
          <Link href="/"><Button>Back to home</Button></Link>
        </Container>
      </Section>
    );
  }

  return (
    <Section padding="md">
      <Container size="wide">
        <ConfirmationLayout order={order} />
      </Container>
    </Section>
  );
}
