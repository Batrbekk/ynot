import type { User } from "@prisma/client";
import { prisma } from "../db/client";

interface CreateUserInput {
  email: string;
  passwordHash: string;
  name?: string;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  return prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
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
