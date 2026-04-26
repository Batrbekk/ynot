import { describe, it, expect, beforeEach } from "vitest";
import { useCookieConsentStore } from "../cookie-consent-store";

beforeEach(() => {
  useCookieConsentStore.setState({ status: "pending" });
});

describe("cookie consent store", () => {
  it("starts in pending state", () => {
    expect(useCookieConsentStore.getState().status).toBe("pending");
  });

  it("accept marks status as accepted", () => {
    useCookieConsentStore.getState().accept();
    expect(useCookieConsentStore.getState().status).toBe("accepted");
  });

  it("decline marks status as declined", () => {
    useCookieConsentStore.getState().decline();
    expect(useCookieConsentStore.getState().status).toBe("declined");
  });

  it("isResolved returns true when not pending", () => {
    expect(useCookieConsentStore.getState().isResolved()).toBe(false);
    useCookieConsentStore.getState().accept();
    expect(useCookieConsentStore.getState().isResolved()).toBe(true);
  });
});
