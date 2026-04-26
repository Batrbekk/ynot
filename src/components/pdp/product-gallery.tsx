"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";

export interface ProductGalleryProps {
  images: string[];
  alt: string;
}

export function ProductGallery({ images, alt }: ProductGalleryProps) {
  const [active, setActive] = React.useState(0);
  if (images.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-surface-secondary">
        <Image
          key={active}
          src={images[active]}
          alt={alt}
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
      </div>

      {images.length > 1 && (
        <>
          {/* Desktop thumbs */}
          <div className="hidden gap-3 md:grid md:grid-cols-6">
            {images.map((src, i) => (
              <button
                key={src + i}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show image ${i + 1}`}
                className={cn(
                  "relative aspect-square overflow-hidden border",
                  i === active ? "border-foreground-primary" : "border-transparent",
                )}
              >
                <Image src={src} alt="" fill sizes="80px" className="object-cover" />
              </button>
            ))}
          </div>

          {/* Mobile dots */}
          <div className="flex justify-center gap-2 md:hidden">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show image ${i + 1}`}
                className={cn(
                  "h-1.5 w-6 transition-colors",
                  i === active ? "bg-foreground-primary" : "bg-border-light",
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
