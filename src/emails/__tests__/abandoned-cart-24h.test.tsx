import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import { AbandonedCart24h } from "../abandoned-cart-24h";

describe("AbandonedCart24h", () => {
  it("renders cart preview with promo code and expiry", async () => {
    const html = await render(
      <AbandonedCart24h
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
        promoCode="YN-COMEBACK-XYZ"
        promoExpiresAt="2026-05-08 12:00 UTC"
      />,
    );
    expect(html).toMatchSnapshot();
    expect(html).toContain("Wool Coat");
    expect(html).toContain("YN-COMEBACK-XYZ");
    expect(html).toContain("2026-05-08 12:00 UTC");
    expect(html).toContain("10% off");
  });
});
