import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import { PasswordReset } from "../password-reset";

describe("PasswordReset", () => {
  it("renders reset code with expiry", async () => {
    const html = await render(
      <PasswordReset customerName="Anna" resetCode="654321" expiresInMinutes={15} />,
    );
    expect(html).toMatchSnapshot();
    expect(html).toContain("654321");
    expect(html).toContain("15 minutes");
  });

  it("renders resetUrl variant when provided", async () => {
    const html = await render(
      <PasswordReset
        resetUrl="https://ynotlondon.com/reset?token=abc"
        expiresInMinutes={30}
      />,
    );
    expect(html).toContain("https://ynotlondon.com/reset?token=abc");
    expect(html).toContain("30 minutes");
  });
});
