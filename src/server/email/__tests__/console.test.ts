import { describe, expect, it, vi } from "vitest";
import { ConsoleEmailService } from "../console";

describe("ConsoleEmailService", () => {
  it("prints the verification code to stderr", async () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const svc = new ConsoleEmailService();
    await svc.sendVerificationCode("user@example.com", "483019");
    const output = spy.mock.calls.map((c) => c[0]).join("");
    spy.mockRestore();
    expect(output).toContain("user@example.com");
    expect(output).toContain("483019");
    expect(output).toContain("Verification");
  });

  it("prints the reset code to stderr", async () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const svc = new ConsoleEmailService();
    await svc.sendPasswordResetCode("user@example.com", "271828");
    const output = spy.mock.calls.map((c) => c[0]).join("");
    spy.mockRestore();
    expect(output).toContain("user@example.com");
    expect(output).toContain("271828");
    expect(output).toContain("Reset");
  });
});
