import * as React from "react";
import { Accordion } from "@/components/ui/accordion";
import type { Product } from "@/lib/schemas";

export function ProductDetailsAccordion({ product }: { product: Product }) {
  return (
    <Accordion
      multiple
      items={[
        {
          value: "description",
          title: "Description",
          content: <p>{product.description}</p>,
        },
        {
          value: "materials",
          title: "Materials",
          content: <p>{product.details.materials}</p>,
        },
        {
          value: "care",
          title: "Care",
          content: <p>{product.details.care}</p>,
        },
        {
          value: "sizing",
          title: "Sizing",
          content: <p>{product.details.sizing}</p>,
        },
      ]}
    />
  );
}
