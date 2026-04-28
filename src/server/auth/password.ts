import bcrypt from "bcryptjs";

const PASSWORD_COST = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, PASSWORD_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  // bcrypt.compare returns false (rather than throwing) for malformed hashes,
  // which is the behaviour we want at the auth layer.
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
