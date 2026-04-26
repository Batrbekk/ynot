import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { HeroSection } from "@/components/blocks/hero-section";
import { BrandStatement } from "@/components/blocks/brand-statement";
import { ProductsRow } from "@/components/blocks/products-row";
import { EditorialBlock } from "@/components/blocks/editorial-block";
import { LookbookCarousel } from "@/components/blocks/lookbook-carousel";
import { getHero, getLookbook } from "@/lib/data/content";
import { getNewArrivals, getAllProducts } from "@/lib/data/products";

export default async function Home() {
  const [hero, lookbook, newArrivals, allProducts] = await Promise.all([
    getHero(),
    getLookbook(),
    getNewArrivals(4),
    getAllProducts(),
  ]);

  // Pick a "Timeless" hero product for the editorial block
  const timeless = allProducts.find((p) => p.slug === "the-chelsea-jacket") ?? allProducts[0];

  return (
    <>
      <AnnouncementBar />
      <SiteHeader overHero />

      <main className="flex-1">
        <HeroSection hero={hero} />
        <BrandStatement
          primary="Urban outerwear, built to endure. Designed to be relied on."
          secondary="Why not is not a question. It’s how she lives."
        />
        <ProductsRow
          title="New Arrivals"
          products={newArrivals}
          ctaHref="/collection/jackets"
        />
        <EditorialBlock
          title="Timeless Collection"
          body="Signature silhouettes that anchor the collection, crafted with ease and refinement for continual wear."
          image={timeless.images[0]}
          ctaHref="/collection/jackets"
          ctaLabel="Explore"
        />
        <LookbookCarousel lookbook={lookbook} />
      </main>

      <SiteFooter />
      <WhatsAppWidget phone="+44 7000 000000" message="Hi YNOT, I have a question." />
    </>
  );
}
