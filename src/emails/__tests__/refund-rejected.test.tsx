import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import { RefundRejected } from "../refund-rejected";

describe("RefundRejected", () => {
  it("renders rejection reason and inspection notes with mailto link", async () => {
    const html = await render(
      <RefundRejected
        returnNumber="RT-2026-00007"
        orderNumber="YN-2026-00042"
        customerName="Anna"
        rejectionReason="Item shows clear signs of wear beyond inspection."
        inspectionNotes="Tag missing; light scuffing on collar."
      />,
    );
    expect(html).toMatchSnapshot();
    expect(html).toContain("RT-2026-00007");
    expect(html).toContain("YN-2026-00042");
    expect(html).toContain("clear signs of wear");
    expect(html).toContain("Tag missing");
    expect(html).toContain("hello@ynotlondon.com");
  });
});
