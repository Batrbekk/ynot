import { describe, expect, it } from "vitest";
import type { SendEmailInput } from "../types";

describe("EmailService input shape", () => {
  it("accepts subject, html, text, attachments", () => {
    const input: SendEmailInput = {
      to: "a@b.com",
      subject: "Test",
      html: "<p>Hi</p>",
      text: "Hi",
      attachments: [{ filename: "a.pdf", content: Buffer.from("x") }],
    };
    expect(input.attachments?.length).toBe(1);
  });
});
