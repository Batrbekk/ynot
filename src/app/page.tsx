import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { HeroSection } from "@/components/blocks/hero-section";
import { BrandStatement } from "@/components/blocks/brand-statement";
import { ProductsRow } from "@/components/blocks/products-row";
import { EditorialOverlay } from "@/components/blocks/editorial-overlay";
import { LookbookCarousel } from "@/components/blocks/lookbook-carousel";
import { FadeUpOnScroll } from "@/components/blocks/fade-up-on-scroll";
import { getHero, getLookbook } from "@/lib/data/content";
import { getNewArrivals } from "@/lib/data/products";

export default async function Home() {
  const [hero, lookbook, newArrivals] = await Promise.all([
    getHero(),
    getLookbook(),
    getNewArrivals(4),
  ]);

  const timelessImage = "/cms/timeless.jpg";

  return (
    <>
      {/* Chrome stack — fixed over the hero, transparent at start, white on scroll */}
      <div className="fixed top-0 left-0 right-0 z-40">
        <AnnouncementBar />
        <SiteHeader overHero />
      </div>

      <main className="flex-1">
        <HeroSection hero={hero} />
        <FadeUpOnScroll>
          <BrandStatement
            primary="Urban outerwear, built to endure."
            secondary="Why not is not a question. It’s how she lives."
          />
        </FadeUpOnScroll>
        <FadeUpOnScroll>
          <ProductsRow
            title="New Arrivals"
            products={newArrivals}
            ctaHref="/collection/jackets"
          />
        </FadeUpOnScroll>
        <FadeUpOnScroll>
          <EditorialOverlay
            title="Timeless Collection"
            body="Signature silhouettes that anchor the collection, crafted with ease and refinement for continual wear."
            image={timelessImage}
            ctaHref="/collection/jackets"
            ctaLabel="Explore"
          />
        </FadeUpOnScroll>
        <FadeUpOnScroll>
          <LookbookCarousel lookbook={lookbook} />
        </FadeUpOnScroll>
      </main>

      <SiteFooter />
      <WhatsAppWidget phone="+44 7000 000000" message="Hi YNOT, I have a question." />
    </>
  );
}
