"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { SizeSelector } from "@/components/ui/size-selector";
import { useCartStore } from "@/lib/stores/cart-store";
import type { Product, Size } from "@/lib/schemas";

export interface AddToBagSectionProps {
  product: Product;
}

export function AddToBagSection({ product }: AddToBagSectionProps) {
  const [size, setSize] = React.useState<Size | null>(null);
  const addItem = useCartStore((s) => s.addItem);
  const openDrawer = useCartStore((s) => s.openDrawer);

  const onAdd = () => {
    if (!size) return;
    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.images[0] ?? "",
      colour: product.colour ?? "",
      size,
      unitPrice: product.price,
      quantity: 1,
      preOrder: product.preOrder,
    });
    openDrawer();
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-foreground-secondary mb-3">
          Size
        </p>
        <SizeSelector
          sizes={product.sizes}
          value={size}
          onChange={(s) => setSize(s)}
          stock={product.stock}
          allowSoldOut={product.preOrder}
        />
      </div>

      <Button size="lg" fullWidth onClick={onAdd} disabled={!size}>
        {product.preOrder ? "Pre-order (3 weeks)" : "Add to bag"}
      </Button>
    </div>
  );
}
