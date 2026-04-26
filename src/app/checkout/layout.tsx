import * as React from "react";
import { CheckoutHeader } from "@/components/checkout/checkout-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";

export const metadata = {
  title: "Checkout · YNOT London",
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CheckoutHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <WhatsAppWidget phone="+44 7000 000000" message="I have a question about my order." />
    </>
  );
}
