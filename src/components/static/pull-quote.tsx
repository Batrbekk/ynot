import * as React from "react";

export interface PullQuoteProps {
  quote: string;
  attribution?: string;
}

export function PullQuote({ quote, attribution }: PullQuoteProps) {
  return (
    <blockquote className="mx-auto max-w-3xl text-center px-6">
      <p className="font-heading text-[28px] leading-snug text-foreground-primary md:text-[36px]">
        “{quote}”
      </p>
      {attribution && (
        <footer className="mt-6 text-[12px] uppercase tracking-[0.25em] text-foreground-secondary">
          — {attribution}
        </footer>
      )}
    </blockquote>
  );
}
