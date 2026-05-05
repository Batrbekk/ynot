import type { ProductStatus } from '@prisma/client';

export const ALLOWED_PRODUCT_TRANSITIONS: Record<ProductStatus, ProductStatus[]> = {
  DRAFT: ['PUBLISHED', 'ARCHIVED'],
  PUBLISHED: ['DRAFT', 'ARCHIVED'],
  ARCHIVED: ['DRAFT'],
};

export class IllegalProductTransitionError extends Error {
  constructor(from: ProductStatus, to: ProductStatus) {
    super(`Illegal product status transition: ${from} → ${to}`);
    this.name = 'IllegalProductTransitionError';
  }
}

export function assertProductTransition(from: ProductStatus, to: ProductStatus): void {
  if (from === to) return;
  if (!ALLOWED_PRODUCT_TRANSITIONS[from].includes(to)) {
    throw new IllegalProductTransitionError(from, to);
  }
}
