import { describe, expect, it } from "vitest";
import { ConsoleEmailService } from "../console";

describe("ConsoleEmailService", () => {
  it("logs subject + text + attachment names to stderr", async () => {
    const stderr: string[] = [];
    const orig = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: unknown) => {
      stderr.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;
    try {
      const svc = new ConsoleEmailService();
      const result = await svc.send({
        to: "a@b.com",
        subject: "Hello",
        html: "<p>x</p>",
        text: "x",
        attachments: [{ filename: "label.pdf", content: Buffer.from("PDF") }],
      });
      expect(result.id).toMatch(/^console-/);
    } finally {
      process.stderr.write = orig;
    }
    const output = stderr.join("");
    expect(output).toContain("Hello");
    expect(output).toContain("a@b.com");
    expect(output).toContain("label.pdf");
  });

  it("does not include attachment line when none provided", async () => {
    const stderr: string[] = [];
    const orig = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: unknown) => {
      stderr.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;
    try {
      const svc = new ConsoleEmailService();
      await svc.send({ to: "u@x.com", subject: "Plain", html: "<p/>", text: "plain" });
    } finally {
      process.stderr.write = orig;
    }
    const output = stderr.join("");
    expect(output).toContain("Plain");
    expect(output).not.toContain("Attachment:");
  });
});
