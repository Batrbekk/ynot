import * as React from "react";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Display } from "@/components/ui/typography";
import { PageHero } from "@/components/static/page-hero";
import { ValueCallouts } from "@/components/static/value-callouts";
import { PullQuote } from "@/components/static/pull-quote";

export const metadata = {
  title: "Our Story · YNOT London",
  description: "Premium women's outerwear designed in London — built to endure, designed to be relied on.",
};

const VALUES = [
  { title: "Timeless design", body: "Pieces designed to transcend seasons and trends — wardrobe foundations rather than fast fashion." },
  { title: "Premium materials", body: "Leather, suede, wool, cotton and Tencel — sourced with integrity from heritage suppliers." },
  { title: "Sustainability", body: "0% leather waste in production. Ethically sourced throughout the supply chain." },
  { title: "London & Istanbul", body: "Designed in our London studio. Made by skilled craftspeople between London and Istanbul." },
];

export default function OurStoryPage() {
  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">
        <PageHero
          title="Our Story"
          image="/cms/our-story/hero.jpg"
        />

        <Section padding="lg">
          <Container size="narrow">
            <div className="flex flex-col gap-6 text-[16px] leading-relaxed text-foreground-primary">
              <p>
                YNOT London was born from a simple belief: outerwear should be as resilient as the women who wear it. Our name carries a quiet philosophy — why not live boldly, dress intentionally, and choose pieces that endure.
              </p>
              <p>
                Every silhouette in our collection is engineered for movement, designed for everyday wear, and constructed to last beyond a single season. We work with materials chosen for their character — leather that softens, wool that insulates, cotton that breathes — and finish each piece with hardware made to outlive trends.
              </p>
            </div>
          </Container>
        </Section>

        <Section padding="lg" background="cream">
          <Container size="wide">
            <Display level="md" as="h2" className="text-center mb-12 text-foreground-on-cream">
              What we stand for
            </Display>
            <ValueCallouts items={VALUES} />
          </Container>
        </Section>

        <Section padding="lg">
          <Container size="wide">
            <PullQuote
              quote="Urban outerwear, built to endure."
              attribution="YNOT London"
            />
          </Container>
        </Section>
      </main>
      <SiteFooter />
      <WhatsAppWidget phone="+44 7000 000000" message="Hi YNOT, I have a question." />
    </>
  );
}
