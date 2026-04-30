import * as React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddToBagSection } from '../add-to-bag-section';
import { useCartStore } from '@/lib/stores/cart-store';
import type { Product } from '@/lib/schemas';

const product: Product = {
  id: 'p1',
  slug: 'leather-biker-jacket',
  name: 'Leather Biker Jacket',
  price: 89500,
  currency: 'GBP',
  description: '',
  images: ['/cms/products/03.jpg'],
  colour: 'Black',
  sizes: ['S', 'M', 'L'],
  categorySlugs: ['jackets', 'leather'],
  stock: { S: 0, M: 3, L: 1 },
  preOrder: false,
  details: { materials: '', care: '', sizing: '' },
};

beforeEach(() => {
  // Reset store to clean state with no snapshot
  useCartStore.setState({ snapshot: null, isOpen: false, isLoading: false });
});

describe('AddToBagSection', () => {
  it('disables Add to bag until a size is selected', () => {
    render(<AddToBagSection product={product} />);
    expect(screen.getByRole('button', { name: /add to bag/i })).toBeDisabled();
  });

  it('calls addItem and opens the drawer when a size is picked + Add clicked', async () => {
    const addItemMock = vi.fn().mockResolvedValue({ ok: true });
    useCartStore.setState({ addItem: addItemMock } as any);
    render(<AddToBagSection product={product} />);
    await userEvent.click(screen.getByRole('button', { name: /size m/i }));
    await userEvent.click(screen.getByRole('button', { name: /add to bag/i }));
    expect(addItemMock).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'p1', size: 'M' }),
    );
    expect(useCartStore.getState().isOpen).toBe(true);
  });

  it('shows PRE-ORDER label when product.preOrder is true', () => {
    render(
      <AddToBagSection
        product={{ ...product, preOrder: true, stock: { S: 0, M: 0, L: 0 } }}
      />,
    );
    expect(
      screen.getByRole('button', { name: /pre-order/i }),
    ).toBeInTheDocument();
  });
});
