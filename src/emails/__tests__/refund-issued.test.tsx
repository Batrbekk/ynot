import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import { RefundIssued } from "../refund-issued";

describe("RefundIssued", () => {
  it("renders amount, items, and 1-3 working days copy", async () => {
    const html = await render(
      <RefundIssued
        returnNumber="RT-2026-00007"
        orderNumber="YN-2026-00042"
        customerName="Anna"
        refundAmountCents={45000}
        items={[{ name: "Coat", qty: 1, priceCents: 45000 }]}
        refundMethod="card"
      />,
    );
    expect(html).toMatchSnapshot();
    expect(html).toContain("RT-2026-00007");
    expect(html).toContain("YN-2026-00042");
    expect(html).toContain("£450.00");
    expect(html).toContain("Coat");
    expect(html).toContain("1-3 working days");
  });
});
