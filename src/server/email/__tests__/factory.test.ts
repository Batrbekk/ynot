import { describe, expect, it } from "vitest";
import { createEmailService } from "../index";
import { ConsoleEmailService } from "../console";
import { ResendEmailService } from "../resend";

describe("createEmailService", () => {
  it("returns ConsoleEmailService when RESEND_API_KEY is missing", () => {
    const svc = createEmailService({});
    expect(svc).toBeInstanceOf(ConsoleEmailService);
  });

  it("returns ConsoleEmailService when RESEND_FROM is missing", () => {
    const svc = createEmailService({ RESEND_API_KEY: "re_xxx" });
    expect(svc).toBeInstanceOf(ConsoleEmailService);
  });

  it("returns ResendEmailService when both Resend env vars are set", () => {
    const svc = createEmailService({ RESEND_API_KEY: "re_xxx", RESEND_FROM: "auth@ynot.london" });
    expect(svc).toBeInstanceOf(ResendEmailService);
  });
});
