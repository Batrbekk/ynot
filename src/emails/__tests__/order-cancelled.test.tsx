import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import { OrderCancelled } from "../order-cancelled";

describe("OrderCancelled", () => {
  it("renders refund amount, ETA, reason and apology", async () => {
    const html = await render(
      <OrderCancelled
        orderNumber="YN-2026-00042"
        customerName="Anna"
        refundAmountCents={45000}
        refundEtaDays={3}
        reasonShort="Out of stock"
      />,
    );
    expect(html).toMatchSnapshot();
    expect(html).toContain("YN-2026-00042");
    expect(html).toContain("£450.00");
    expect(html).toContain("3 working days");
    expect(html).toContain("Out of stock");
    expect(html).toContain("hello@ynotlondon.com");
  });
});
