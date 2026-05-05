import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProductCreateForm } from '../_components/product-create-form';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

describe('<ProductCreateForm>', () => {
  beforeEach(() => {
    pushMock.mockReset();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi.fn();
  });

  it('renders required fields', () => {
    render(<ProductCreateForm />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create product/i })).toBeInTheDocument();
  });

  it('on success POSTs to /api/admin/products and redirects to detail page', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'p123' }),
    });
    render(<ProductCreateForm />);
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Coat' } });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'desc' },
    });
    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: '4500' } });
    fireEvent.click(screen.getByRole('button', { name: /create product/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/admin/products',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/admin/catalog/products/p123');
    });
  });
});
