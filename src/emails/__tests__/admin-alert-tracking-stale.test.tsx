import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import { AdminAlertTrackingStale } from "../admin-alert-tracking-stale";

describe("AdminAlertTrackingStale", () => {
  it("renders affected counts and admin URL", async () => {
    const html = await render(
      <AdminAlertTrackingStale
        affectedCount={7}
        oldestStaleSinceHours={48}
        adminUrl="https://ynotlondon.com/admin/orders?filter=needs-tracking-update"
      />,
    );
    expect(html).toMatchSnapshot();
    expect(html).toContain("7 orders");
    expect(html).toContain("48 hours");
    expect(html).toContain("filter=needs-tracking-update");
  });
});
