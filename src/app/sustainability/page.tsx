import * as React from "react";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Display } from "@/components/ui/typography";
import { PageHero } from "@/components/static/page-hero";
import { StatsBlock } from "@/components/static/stats-block";

export const metadata = {
  title: "Sustainability · YNOT London",
  description: "Our approach to sustainability and animal welfare — by-product sourcing, LWG certification, zero waste production.",
};

const STATS = [
  { value: "0%", label: "Leather waste" },
  { value: "100%", label: "By-product sourcing" },
  { value: "LWG", label: "Certified partners" },
];

const APPROACHES = [
  {
    title: "By-product sourcing",
    body: "All leather used in YNOT products is a by-product of the food industry. We ensure that no animal is raised or harmed for the sole purpose of leather production.",
  },
  {
    title: "LWG certification",
    body: "We partner exclusively with tanneries certified by the Leather Working Group, ensuring the highest standards in environmental management, water treatment, and energy efficiency.",
  },
  {
    title: "Zero waste production",
    body: "Our cutting process is optimised to achieve 0% leather waste. Offcuts are repurposed for smaller accessories or returned to suppliers for use in other products.",
  },
  {
    title: "Responsible fibres",
    body: "We use Tencel, a sustainably sourced wood fibre, alongside responsibly produced wool and organic cotton. Every material is chosen with the planet in mind.",
  },
];

export default function SustainabilityPage() {
  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">
        <PageHero
          eyebrow="Sustainability & Animal Welfare"
          title="Responsibility, woven in."
          description="At YNOT London, sustainability isn't a trend — it's a responsibility. We believe that creating beautiful outerwear shouldn't come at the cost of the planet."
        />

        <Section padding="lg">
          <Container size="wide">
            <StatsBlock stats={STATS} />
          </Container>
        </Section>

        <Section padding="lg" background="cream">
          <Container size="wide">
            <Display level="md" as="h2" className="text-center mb-16 text-foreground-on-cream">
              Our approach
            </Display>
            <div className="grid gap-12 md:grid-cols-2 md:gap-16">
              {APPROACHES.map((a) => (
                <article key={a.title} className="flex flex-col gap-3">
                  <h3 className="font-heading text-[24px] text-foreground-on-cream">{a.title}</h3>
                  <p className="text-[15px] leading-relaxed text-foreground-on-cream">{a.body}</p>
                </article>
              ))}
            </div>
          </Container>
        </Section>
      </main>
      <SiteFooter />
      <WhatsAppWidget phone="+44 7000 000000" message="Hi YNOT, I have a question." />
    </>
  );
}
