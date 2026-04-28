import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../password";

describe("password", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("hunter2-correct-horse");
    expect(await verifyPassword("hunter2-correct-horse", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("hunter2-correct-horse");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("returns false for an obviously malformed hash", async () => {
    expect(await verifyPassword("anything", "not-a-bcrypt-hash")).toBe(false);
  });
});
