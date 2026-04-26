"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { SizeSelector } from "@/components/ui/size-selector";
import { ColourSwatch } from "@/components/ui/colour-swatch";
import { useCartStore } from "@/lib/stores/cart-store";
import type { Product, Size, ColourOption } from "@/lib/schemas";

export interface AddToBagSectionProps {
  product: Product;
}

function defaultColour(product: Product): ColourOption | null {
  if (product.colourOptions && product.colourOptions.length > 0) {
    return product.colourOptions[0];
  }
  if (product.colour) {
    return { name: product.colour, hex: "#1A1A1A" };
  }
  return null;
}

export function AddToBagSection({ product }: AddToBagSectionProps) {
  const [size, setSize] = React.useState<Size | null>(null);
  const [colour, setColour] = React.useState<ColourOption | null>(() =>
    defaultColour(product),
  );
  const addItem = useCartStore((s) => s.addItem);
  const openDrawer = useCartStore((s) => s.openDrawer);

  const selectedStock = size ? (product.stock[size] ?? 0) : 0;
  const isPreOrderForSelection =
    product.preOrder || (size !== null && selectedStock === 0);

  const onAdd = () => {
    if (!size) return;
    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.images[0] ?? "",
      colour: colour?.name ?? "",
      size,
      unitPrice: product.price,
      quantity: 1,
      preOrder: isPreOrderForSelection,
    });
    openDrawer();
  };

  const showColourPicker =
    product.colourOptions && product.colourOptions.length > 1;

  return (
    <div className="flex flex-col gap-6">
      {(colour || product.colour) && (
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-foreground-secondary mb-2">
            Colour
          </p>
          {colour && (
            <p className="text-[14px] text-foreground-primary mb-3">{colour.name}</p>
          )}
          {showColourPicker && product.colourOptions && (
            <div className="flex flex-wrap gap-2">
              {product.colourOptions.map((c) => (
                <ColourSwatch
                  key={c.name}
                  name={c.name}
                  hex={c.hex}
                  selected={colour?.name === c.name}
                  onClick={() => setColour(c)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-foreground-secondary mb-3">
          Size
        </p>
        <SizeSelector
          sizes={product.sizes}
          value={size}
          onChange={(s) => setSize(s)}
          stock={product.stock}
          allowSoldOut
        />
      </div>

      <Button
        size="lg"
        fullWidth
        variant={isPreOrderForSelection ? "preorder" : "primary"}
        onClick={onAdd}
        disabled={!size}
      >
        {isPreOrderForSelection ? "Pre-order (3-4 weeks)" : "Add to bag"}
      </Button>
    </div>
  );
}
