import { describe, expect, it } from "vitest";
import { getTrackingUrl } from "../tracking-url";

describe("getTrackingUrl", () => {
  it("returns Royal Mail URL with tracking number in the path", () => {
    expect(getTrackingUrl("ROYAL_MAIL", "AB123456789GB")).toBe(
      "https://www.royalmail.com/track/AB123456789GB",
    );
  });

  it("returns DHL URL with tracking-id query parameter", () => {
    expect(getTrackingUrl("DHL", "1234567890")).toBe(
      "https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id=1234567890",
    );
  });

  it("returns null for missing tracking number", () => {
    expect(getTrackingUrl("ROYAL_MAIL", null)).toBeNull();
    expect(getTrackingUrl("DHL", "")).toBeNull();
    expect(getTrackingUrl("DHL", undefined)).toBeNull();
  });
});
