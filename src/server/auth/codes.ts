import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db/client";

// Lower than the password cost (10). Codes live ≤ 15 min and are 6 ASCII
// digits; the threat model is online rate-limited guessing, not offline
// brute-force of a stolen hash. Documented here so future contributors do
// not "harmonise" the two cost factors.
const CODE_COST = 8;
const TOKEN_TTL_MS = 15 * 60 * 1000;

export type TokenKind = "verify" | "reset";

export function verificationIdentifier(kind: TokenKind, email: string): string {
  return `${kind}:${email}`;
}

/** 6-digit numeric code, zero-padded. Cryptographically random. */
export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * Issue a fresh code for `kind:email`. Replaces any previous tokens for the
 * same identifier so the user always works with the most recent code.
 * Returns the plain-text code so the caller can email it; never logs it.
 */
export async function issueVerificationToken(
  kind: TokenKind,
  email: string,
): Promise<string> {
  const identifier = verificationIdentifier(kind, email);
  const code = generateCode();
  const tokenHash = await bcrypt.hash(code, CODE_COST);
  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: {
      identifier,
      token: tokenHash,
      expires: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });
  return code;
}

/**
 * Consume a code: returns true on success and deletes the row, returns false
 * on mismatch / expiry / no row.
 */
export async function consumeVerificationToken(
  kind: TokenKind,
  email: string,
  code: string,
): Promise<boolean> {
  const identifier = verificationIdentifier(kind, email);
  const rows = await prisma.verificationToken.findMany({
    where: { identifier },
  });
  for (const row of rows) {
    if (row.expires.getTime() < Date.now()) continue;
    const match = await bcrypt.compare(code, row.token);
    if (match) {
      await prisma.verificationToken.delete({
        where: { identifier_token: { identifier: row.identifier, token: row.token } },
      });
      return true;
    }
  }
  return false;
}
