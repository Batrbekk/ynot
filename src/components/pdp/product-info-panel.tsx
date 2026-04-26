import * as React from "react";
import { Display } from "@/components/ui/typography";
import { formatPrice } from "@/lib/format";

export interface ProductInfoPanelProps {
  name: string;
  price: number;
  children?: React.ReactNode;
}

export function ProductInfoPanel({
  name,
  price,
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
      {children}
    </div>
  );
}
