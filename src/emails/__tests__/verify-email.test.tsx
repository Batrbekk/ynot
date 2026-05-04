import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import { VerifyEmail } from "../verify-email";

describe("VerifyEmail", () => {
  it("renders verification code with expiry", async () => {
    const html = await render(
      <VerifyEmail customerName="Anna" verificationCode="123456" expiresInMinutes={15} />,
    );
    expect(html).toMatchSnapshot();
    expect(html).toContain("123456");
    expect(html).toContain("15 minutes");
  });

  it("renders verifyUrl variant when provided", async () => {
    const html = await render(
      <VerifyEmail
        verifyUrl="https://ynotlondon.com/verify?token=abc"
        expiresInMinutes={30}
      />,
    );
    expect(html).toContain("https://ynotlondon.com/verify?token=abc");
    expect(html).toContain("30 minutes");
  });
});
