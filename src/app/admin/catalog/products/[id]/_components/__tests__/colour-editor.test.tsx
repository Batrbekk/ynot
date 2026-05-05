import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ColourEditor } from '../colour-editor';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe('<ColourEditor>', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi.fn();
  });

  it('renders initial rows', () => {
    render(
      <ColourEditor
        productId="p1"
        initial={[{ name: 'Black', hex: '#000000' }]}
      />,
    );
    expect(screen.getByTestId('colour-row-0')).toBeInTheDocument();
  });

  it('add adds a row', () => {
    render(<ColourEditor productId="p1" initial={[]} />);
    fireEvent.click(screen.getByText(/add colour/i));
    expect(screen.getByTestId('colour-row-0')).toBeInTheDocument();
  });

  it('rejects invalid hex on save', async () => {
    render(
      <ColourEditor
        productId="p1"
        initial={[{ name: 'Red', hex: 'red' }]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /save colours/i }));
    await waitFor(() => {
      expect(screen.getByText(/invalid hex/i)).toBeInTheDocument();
    });
  });

  it('on save PATCHes /colours', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchMock = globalThis.fetch as any;
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
    render(
      <ColourEditor
        productId="p1"
        initial={[{ name: 'Black', hex: '#000000' }]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /save colours/i }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/products/p1/colours',
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });
});
