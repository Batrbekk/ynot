import Image from "next/image";
import Link from "next/link";
import { searchProducts } from "@/server/data/search";
import { formatPrice } from "@/lib/format";
import { Container } from "@/components/ui/container";
import { Display, Eyebrow } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  return {
    title: q ? `Search: "${q}" · YNOT London` : "Search · YNOT London",
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = "" } = await searchParams;
  const results = await searchProducts(q);

  return (
    <Container size="wide" className="py-16">
      <Eyebrow>Search results</Eyebrow>
      <Display level="md" as="h1" className="mt-3">
        {q ? `“${q}”` : "Type something to search"}
      </Display>
      <p className="mt-2 text-[14px] text-foreground-secondary">
        {q
          ? `${results.length} ${results.length === 1 ? "result" : "results"}`
          : ""}
      </p>

      {results.length > 0 && (
        <div className="mt-12 grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8">
          {results.map((p) => (
            <Link key={p.id} href={`/products/${p.slug}`} className="group block">
              <div className="relative aspect-[3/4] w-full bg-surface-secondary overflow-hidden">
                <Image
                  src={p.images[0]}
                  alt={p.name}
                  fill
                  sizes="(min-width: 1024px) 25vw, 50vw"
                  className="object-cover"
                />
              </div>
              <p className="mt-3 text-[13px] font-medium">{p.name}</p>
              <p className="text-[13px] text-foreground-secondary">
                {formatPrice(p.price, "GBP")}
              </p>
            </Link>
          ))}
        </div>
      )}

      {q && results.length === 0 && (
        <p className="mt-10 text-[14px] text-foreground-secondary">
          Nothing matched. Try a different search term.
        </p>
      )}
    </Container>
  );
}
