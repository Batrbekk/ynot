import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import { AdminAlertLabelFailure } from "../admin-alert-label-failure";

describe("AdminAlertLabelFailure", () => {
  it("renders order, error, and admin URL", async () => {
    const html = await render(
      <AdminAlertLabelFailure
        orderNumber="YN-2026-00042"
        shipmentId="shp_abc"
        errorMessage="DHL API 500: temporarily unavailable"
        adminUrl="https://ynotlondon.com/admin/orders/abc/ship"
      />,
    );
    expect(html).toMatchSnapshot();
    expect(html).toContain("YN-2026-00042");
    expect(html).toContain("shp_abc");
    expect(html).toContain("DHL API 500");
    expect(html).toContain("https://ynotlondon.com/admin/orders/abc/ship");
  });
});
