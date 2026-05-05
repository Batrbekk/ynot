import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CategoryMultiselect } from '../category-multiselect';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const CATS = [
  { id: 'c1', name: 'Outerwear', slug: 'outerwear', parentId: null },
  { id: 'c2', name: 'Coats', slug: 'coats', parentId: 'c1' },
  { id: 'c3', name: 'Footwear', slug: 'footwear', parentId: null },
];

describe('<CategoryMultiselect>', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi.fn();
  });

  it('renders all categories', () => {
    render(
      <CategoryMultiselect productId="p1" categories={CATS} selectedIds={[]} />,
    );
    expect(screen.getByText('Outerwear')).toBeInTheDocument();
    expect(screen.getByText('Coats')).toBeInTheDocument();
    expect(screen.getByText('Footwear')).toBeInTheDocument();
  });

  it('reflects initial selectedIds', () => {
    render(
      <CategoryMultiselect productId="p1" categories={CATS} selectedIds={['c2']} />,
    );
    expect((screen.getByTestId('cat-c2') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId('cat-c1') as HTMLInputElement).checked).toBe(false);
  });

  it('toggles selection on click', () => {
    render(
      <CategoryMultiselect productId="p1" categories={CATS} selectedIds={[]} />,
    );
    fireEvent.click(screen.getByTestId('cat-c1'));
    expect((screen.getByTestId('cat-c1') as HTMLInputElement).checked).toBe(true);
  });

  it('save PATCHes /products/[id] with categoryIds', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchMock = globalThis.fetch as any;
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    render(
      <CategoryMultiselect productId="p1" categories={CATS} selectedIds={['c1']} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /save categories/i }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/products/p1',
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.categoryIds).toEqual(['c1']);
  });
});
