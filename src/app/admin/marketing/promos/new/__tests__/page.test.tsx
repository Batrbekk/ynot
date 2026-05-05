import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PromoCreateForm } from '../_components/promo-create-form';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

describe('<PromoCreateForm>', () => {
  beforeEach(() => {
    pushMock.mockReset();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi.fn();
  });

  it('on success POSTs to /api/admin/promos and redirects', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'p1' }),
    });
    render(<PromoCreateForm />);
    fireEvent.change(screen.getByLabelText(/code/i), { target: { value: 'WELCOME10' } });
    fireEvent.change(screen.getByLabelText(/discount value/i), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /create promo/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/admin/promos',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/admin/marketing/promos/p1');
    });
  });

  it('shows error when server returns 409', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis.fetch as any).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'CONFLICT', message: 'code already exists' }),
    });
    render(<PromoCreateForm />);
    fireEvent.change(screen.getByLabelText(/code/i), { target: { value: 'WELCOME10' } });
    fireEvent.change(screen.getByLabelText(/discount value/i), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /create promo/i }));

    await waitFor(() => {
      expect(screen.getByText(/already exists/i)).toBeTruthy();
    });
  });
});
