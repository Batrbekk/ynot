import * as React from "react";
import Image from "next/image";
import { Display } from "@/components/ui/typography";

export interface CategoryHeaderProps {
  title: string;
  description?: string;
  bannerImage?: string | null;
}

export function CategoryHeader({
  title,
  description,
  bannerImage,
}: CategoryHeaderProps) {
  if (bannerImage) {
    return (
      <header className="relative h-[40vh] min-h-[280px] w-full overflow-hidden bg-surface-dark">
        <Image
          src={bannerImage}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative z-10 flex h-full flex-col items-center justify-center text-center text-foreground-inverse px-6">
          <Display level="lg" as="h1">
            {title}
          </Display>
          {description && (
            <p className="mt-3 max-w-md text-[14px]">{description}</p>
          )}
        </div>
      </header>
    );
  }
  return (
    <header className="border-b border-border-light py-12 text-center">
      <Display level="lg" as="h1">
        {title}
      </Display>
      {description && (
        <p className="mt-3 mx-auto max-w-[640px] text-[14px] text-foreground-secondary">
          {description}
        </p>
      )}
    </header>
  );
}
