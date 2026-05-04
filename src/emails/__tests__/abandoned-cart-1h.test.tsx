import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import { AbandonedCart1h } from "../abandoned-cart-1h";

describe("AbandonedCart1h", () => {
  it("renders cart preview with images and CTA, no discount", async () => {
    const html = await render(
      <AbandonedCart1h
        customerName="Anna"
        items={[
          {
            name: "Wool Coat",
            image: "https://ynotlondon.com/img/coat.jpg",
            priceCents: 45000,
            qty: 1,
          },
        ]}
        cartUrl="https://ynotlondon.com/cart?token=abc"
      />,
    );
    expect(html).toMatchSnapshot();
    expect(html).toContain("Wool Coat");
    expect(html).toContain("https://ynotlondon.com/img/coat.jpg");
    expect(html).toContain("https://ynotlondon.com/cart?token=abc");
    expect(html).not.toMatch(/\d+%\s*off|promo code/i);
  });
});
