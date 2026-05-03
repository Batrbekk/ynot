import { describe, expect, it, vi } from "vitest";
import { Heading } from "@react-email/components";
import { sendTemplatedEmail } from "../send";
import type { EmailService } from "../types";

describe("sendTemplatedEmail", () => {
  it("renders the component then forwards to EmailService.send", async () => {
    const sendMock = vi.fn().mockResolvedValue({ id: "eml_1" });
    const fakeSvc: EmailService = { send: sendMock };
    const r = await sendTemplatedEmail({
      service: fakeSvc,
      to: "a@b.com",
      subject: "Hi",
      component: <Heading>Hello</Heading>,
    });
    expect(r.id).toBe("eml_1");
    expect(sendMock).toHaveBeenCalledOnce();
    const arg = sendMock.mock.calls[0][0];
    expect(arg.to).toBe("a@b.com");
    expect(arg.subject).toBe("Hi");
    expect(arg.html).toContain("Hello");
    expect(arg.text.toLowerCase()).toContain("hello");
  });

  it("forwards attachments through to the service", async () => {
    const sendMock = vi.fn().mockResolvedValue({ id: "eml_2" });
    const fakeSvc: EmailService = { send: sendMock };
    const att = [{ filename: "label.pdf", content: Buffer.from("PDF") }];
    await sendTemplatedEmail({
      service: fakeSvc,
      to: "a@b.com",
      subject: "Hi",
      component: <Heading>Hello</Heading>,
      attachments: att,
    });
    expect(sendMock.mock.calls[0][0].attachments).toBe(att);
  });
});
