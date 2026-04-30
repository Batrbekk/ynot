import { Prisma, type User } from "@prisma/client";
import { prisma } from "../db/client";

interface CreateUserInput {
  email: string;
  passwordHash?: string;
  name?: string;
  // Optional name parts accepted for API symmetry; stored in `name` field.
  firstName?: string | null;
  lastName?: string | null;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  return prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash ?? null,
      name: input.name ?? null,
    },
  });
}

export async function findUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findFirst({
    where: { email: email.toLowerCase(), deletedAt: null },
  });
}

export async function markEmailVerified(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerifiedAt: new Date() },
  });
}

export async function updatePassword(userId: string, passwordHash: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}

export async function softDeleteUser(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: new Date() },
  });
  await prisma.session.deleteMany({ where: { userId } });
}

export class EmailTakenByFullAccountError extends Error {
  constructor(public readonly email: string) {
    super(`Email ${email} already has a full account`);
    this.name = 'EmailTakenByFullAccountError';
  }
}

export interface CreateGuestUserInput {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

export async function createGuestUser(input: CreateGuestUserInput): Promise<User> {
  return prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      passwordHash: null,
      isGuest: true,
      emailVerifiedAt: null,
    },
  });
}

/**
 * Find a ghost user by email; create one if absent. If the email already
 * belongs to a non-guest user, throw — caller decides how to surface
 * (typically a 409 prompting "sign in to use this email").
 */
export async function getOrCreateGuestUser(
  input: CreateGuestUserInput,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<User> {
  const email = input.email.toLowerCase();
  const existing = await client.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.isGuest) return existing;
    throw new EmailTakenByFullAccountError(email);
  }
  return client.user.create({
    data: {
      email,
      passwordHash: null,
      isGuest: true,
      emailVerifiedAt: null,
    },
  });
}
