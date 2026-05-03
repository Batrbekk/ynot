import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import { OrderShipped } from "../order-shipped";

describe("OrderShipped", () => {
  it("shows tracking number + tracking URL + carrier name", async () => {
    const html = await render(
      <OrderShipped
        orderNumber="YN-2026-00042"
        customerName="Anna"
        carrier="ROYAL_MAIL"
        trackingNumber="RM12345"
        trackingUrl="https://www.royalmail.com/track/RM12345"
        estimatedDelivery="2026-05-08"
        itemsCount={2}
      />,
    );
    expect(html).toMatchSnapshot();
    expect(html).toContain("RM12345");
    expect(html).toContain("Royal Mail");
    expect(html).toContain("https://www.royalmail.com/track/RM12345");
  });
});
