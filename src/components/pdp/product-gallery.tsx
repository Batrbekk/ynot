"use client";

import * as React from "react";
import Image from "next/image";
import { AnimatePresence, motion, type PanInfo, type Variants } from "motion/react";
import { cn } from "@/lib/cn";
import { duration, ease } from "@/lib/motion";

export interface ProductGalleryProps {
  images: string[];
  alt: string;
}

const SWIPE_THRESHOLD = 60;

const slideVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "100%" : "-100%",
    opacity: 0.6,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: duration.base, ease: ease.out },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? "-100%" : "100%",
    opacity: 0.6,
    transition: { duration: duration.base, ease: ease.out },
  }),
};

export function ProductGallery({ images, alt }: ProductGalleryProps) {
  const [active, setActive] = React.useState(0);
  const [direction, setDirection] = React.useState<1 | -1>(1);

  if (images.length === 0) return null;

  const goTo = (next: number, dir: 1 | -1) => {
    setDirection(dir);
    setActive((next + images.length) % images.length);
  };

  const handleDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    if (info.offset.x < -SWIPE_THRESHOLD) goTo(active + 1, 1);
    else if (info.offset.x > SWIPE_THRESHOLD) goTo(active - 1, -1);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-surface-secondary touch-pan-y">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={active}
            className="absolute inset-0"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            drag={images.length > 1 ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.25}
            onDragEnd={handleDragEnd}
          >
            <Image
              src={images[active]}
              alt={alt}
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover pointer-events-none select-none"
              draggable={false}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {images.length > 1 && (
        <>
          {/* Desktop thumbs */}
          <div className="hidden gap-3 md:grid md:grid-cols-6">
            {images.map((src, i) => (
              <button
                key={src + i}
                type="button"
                onClick={() => goTo(i, i > active ? 1 : -1)}
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
                onClick={() => goTo(i, i > active ? 1 : -1)}
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
