import { describe, expect, it, vi, beforeEach } from "vitest";

const sendMock = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

import { ResendEmailService } from "../resend";

describe("ResendEmailService", () => {
  beforeEach(() =>
    sendMock.mockReset().mockResolvedValue({ data: { id: "re_test_xyz" }, error: null }),
  );

  it("sends html+text+attachments and returns Resend id", async () => {
    const svc = new ResendEmailService("re_key", "YNOT <hello@ynotlondon.com>");
    const r = await svc.send({
      to: "a@b.com",
      subject: "Hi",
      html: "<p>Hi</p>",
      text: "Hi",
      attachments: [{ filename: "l.pdf", content: Buffer.from("PDF") }],
    });
    expect(r.id).toBe("re_test_xyz");
    expect(sendMock).toHaveBeenCalledTimes(1);
    const arg = sendMock.mock.calls[0][0];
    expect(arg.from).toBe("YNOT <hello@ynotlondon.com>");
    expect(arg.to).toBe("a@b.com");
    expect(arg.subject).toBe("Hi");
    expect(arg.html).toBe("<p>Hi</p>");
    expect(arg.text).toBe("Hi");
    expect(arg.attachments).toEqual([{ filename: "l.pdf", content: Buffer.from("PDF") }]);
  });

  it("omits attachments key when none provided", async () => {
    const svc = new ResendEmailService("re_key", "YNOT <hello@ynotlondon.com>");
    await svc.send({ to: "a@b.com", subject: "X", html: "<p/>", text: "x" });
    const arg = sendMock.mock.calls[0][0];
    expect(arg.attachments).toBeUndefined();
  });

  it("throws when Resend returns an error", async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: "rate limit" } });
    const svc = new ResendEmailService("re_key", "YNOT <hello@ynotlondon.com>");
    await expect(
      svc.send({ to: "a@b.com", subject: "X", html: "<p/>", text: "x" }),
    ).rejects.toThrow("rate limit");
  });
});
