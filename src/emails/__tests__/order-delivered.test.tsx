import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import { OrderDelivered } from "../order-delivered";

describe("OrderDelivered", () => {
  it("renders with order # and review CTA", async () => {
    const html = await render(
      <OrderDelivered
        orderNumber="YN-2026-00042"
        customerName="Anna"
        reviewUrl="https://ynotlondon.com/account/orders/abc/review"
      />,
    );
    expect(html).toMatchSnapshot();
    expect(html).toContain("YN-2026-00042");
    expect(html).toContain("review");
    expect(html).toContain("https://ynotlondon.com/account/orders/abc/review");
  });
});
