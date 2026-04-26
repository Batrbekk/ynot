import * as React from "react";
import { Display } from "@/components/ui/typography";
import { formatPrice } from "@/lib/format";

export interface ProductInfoPanelProps {
  name: string;
  price: number;
  colour?: string;
  children?: React.ReactNode;
}

export function ProductInfoPanel({
  name,
  price,
  colour,
  children,
}: ProductInfoPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Display level="md" as="h1">
          {name}
        </Display>
        <p className="mt-3 text-[18px] text-foreground-primary">
          {formatPrice(price, "GBP")}
        </p>
      </div>
      {colour && (
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-foreground-secondary">
            Colour
          </p>
          <p className="mt-2 text-[14px] text-foreground-primary">{colour}</p>
        </div>
      )}
      {children}
    </div>
  );
}
