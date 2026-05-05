import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LookbookGridReorder } from '../lookbook-grid-reorder';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe('<LookbookGridReorder>', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('renders empty state when no items', () => {
    render(<LookbookGridReorder items={[]} />);
    expect(screen.getByText(/no lookbook images yet/i)).toBeInTheDocument();
  });

  it('renders one tile per item', () => {
    const items = [
      { id: 'l1', src: 'http://x/1.jpg', alt: '', sortOrder: 0 },
      { id: 'l2', src: 'http://x/2.jpg', alt: '', sortOrder: 1 },
    ];
    render(<LookbookGridReorder items={items} />);
    expect(screen.getByTestId('lookbook-l1')).toBeInTheDocument();
    expect(screen.getByTestId('lookbook-l2')).toBeInTheDocument();
  });

  it('removes item via DELETE', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchMock = globalThis.fetch as any;
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    const items = [{ id: 'l1', src: 'http://x/1.jpg', alt: '', sortOrder: 0 }];
    render(<LookbookGridReorder items={items} />);
    fireEvent.click(screen.getByText('×'));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/content/lookbook/l1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });
});
