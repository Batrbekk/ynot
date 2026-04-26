import * as React from "react";
import Image from "next/image";
import { Display } from "@/components/ui/typography";

export interface AuthCardSideImage {
  src: string;
  alt: string;
}

export interface AuthCardProps {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  sideImage?: AuthCardSideImage;
}

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
  sideImage,
}: AuthCardProps) {
  const formColumn = (
    <div className="mx-auto w-full max-w-[440px] px-6 py-10 md:py-16">
      <div className="text-center mb-8">
        <Display level="md" as="h1">
          {title}
        </Display>
        {subtitle && (
          <p className="mt-3 text-[14px] text-foreground-secondary">{subtitle}</p>
        )}
      </div>
      {children}
      {footer && (
        <div className="mt-8 text-center text-[13px] text-foreground-secondary">
          {footer}
        </div>
      )}
    </div>
  );

  if (!sideImage) {
    return (
      <div className="flex flex-1 items-center justify-center">{formColumn}</div>
    );
  }

  return (
    <div className="grid flex-1 w-full md:grid-cols-2 md:grid-rows-1 overflow-hidden">
      <div className="relative hidden md:block">
        <Image
          src={sideImage.src}
          alt={sideImage.alt}
          fill
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover"
          priority
        />
      </div>
      <div className="flex items-center justify-center overflow-y-auto">
        {formColumn}
      </div>
    </div>
  );
}
