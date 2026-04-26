import * as React from "react";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Prose } from "@/components/ui/prose";
import { PageHero } from "@/components/static/page-hero";

export const metadata = {
  title: "Privacy Policy · YNOT London",
  description: "How YNOT London handles your personal data.",
};

export default function PrivacyPage() {
  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">
        <PageHero eyebrow="Legal" title="Privacy Policy" />
        <Section padding="lg">
          <Container size="narrow">
            <Prose>
              <p>This policy describes how YNOT London (&ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, uses, and protects your personal data when you visit ynotlondon.com or place an order with us.</p>

              <h2>What we collect</h2>
              <p>We collect the information you give us when you create an account, place an order, or contact us — including your name, email, shipping address, phone number, and payment details (processed securely by Stripe).</p>
              <p>We also collect technical data automatically: IP address, browser type, device, and pages you view, via cookies and similar technologies.</p>

              <h2>How we use it</h2>
              <ul>
                <li>To process and fulfil your orders</li>
                <li>To send you order confirmations and shipping updates</li>
                <li>To improve our website and your shopping experience</li>
                <li>To send marketing emails (only if you&rsquo;ve opted in)</li>
              </ul>

              <h2>Sharing</h2>
              <p>We share your data with trusted partners only when necessary — Stripe for payment processing, Royal Mail and DHL for delivery, and our email provider for transactional messages. We never sell your data.</p>

              <h2>Your rights</h2>
              <p>You can access, correct, or delete your personal data at any time. Contact us at hello@ynotlondon.com for any data requests.</p>

              <h2>Cookies</h2>
              <p>We use essential cookies to operate the site and analytics cookies to understand how visitors use it. You can manage your cookie preferences via the banner at the bottom of the page.</p>

              <p className="text-[12px] text-foreground-tertiary mt-12">Last updated: 1 April 2026.</p>
            </Prose>
          </Container>
        </Section>
      </main>
      <SiteFooter />
      <WhatsAppWidget phone="+44 7000 000000" message="Hi YNOT, I have a question." />
    </>
  );
}
