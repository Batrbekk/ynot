import Image from "next/image";
import Link from "next/link";
import type { HeroBlock } from "@/lib/schemas";
import { Button } from "@/components/ui/button";

export function HeroSection({ hero }: { hero: HeroBlock }) {
  return (
    <section className="relative w-full block h-[100svh] min-h-[600px] overflow-hidden bg-surface-dark shrink-0">
      {hero.kind === "image" ? (
        <Image
          src={hero.image}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      ) : (
        <video
          src={hero.videoUrl ?? undefined}
          poster={hero.image}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      <div className="absolute inset-0 bg-black/30" />

      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center text-center text-foreground-inverse px-6">
        <p className="font-heading text-[40px] uppercase tracking-[0.45em] md:text-[56px] md:tracking-[0.55em]">
          {hero.eyebrow}
        </p>
        <Link href={hero.ctaHref} className="mt-12">
          <Button
            size="lg"
            variant="outline"
            className="bg-transparent text-foreground-inverse border-foreground-inverse hover:bg-foreground-inverse hover:text-foreground-primary px-12"
          >
            {hero.ctaLabel}
          </Button>
        </Link>
      </div>
    </section>
  );
}
