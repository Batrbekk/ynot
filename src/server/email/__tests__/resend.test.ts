import { describe, expect, it, vi, beforeEach } from "vitest";

const sendMock = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

import { ResendEmailService } from "../resend";

describe("ResendEmailService", () => {
  beforeEach(() => sendMock.mockReset().mockResolvedValue({ data: { id: "msg_1" }, error: null }));

  it("sends the verification email through the Resend SDK", async () => {
    const svc = new ResendEmailService("re_test", "auth@ynot.london");
    await svc.sendVerificationCode("user@example.com", "483019");
    expect(sendMock).toHaveBeenCalledTimes(1);
    const arg = sendMock.mock.calls[0][0];
    expect(arg.from).toBe("auth@ynot.london");
    expect(arg.to).toBe("user@example.com");
    expect(arg.subject).toMatch(/verification/i);
    expect(arg.text).toContain("483019");
  });

  it("sends the reset email through the Resend SDK", async () => {
    const svc = new ResendEmailService("re_test", "auth@ynot.london");
    await svc.sendPasswordResetCode("user@example.com", "271828");
    const arg = sendMock.mock.calls[0][0];
    expect(arg.subject).toMatch(/reset/i);
    expect(arg.text).toContain("271828");
  });

  it("throws when Resend reports an error", async () => {
    sendMock.mockResolvedValue({ data: null, error: { name: "validation_error", message: "bad address" } });
    const svc = new ResendEmailService("re_test", "auth@ynot.london");
    await expect(svc.sendVerificationCode("user@example.com", "483019")).rejects.toThrow(/bad address/);
  });
});
