import type { Prisma } from "@prisma/client";
import { prisma } from "./client";

export type Tx = Prisma.TransactionClient;

/**
 * Run `fn` inside a Prisma transaction. Rolls back on throw, commits otherwise.
 * Use this whenever a multi-row write must be atomic (e.g. order creation).
 */
export function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn);
}
