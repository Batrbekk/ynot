import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ActivateButton } from '../activate-button';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe('<ActivateButton>', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi.fn();
  });

  it('POSTs to /activate on click', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis.fetch as any).mockResolvedValue({ ok: true, json: async () => ({}) });
    render(<ActivateButton id="h1" />);
    fireEvent.click(screen.getByRole('button', { name: /activate/i }));
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/admin/content/hero/h1/activate',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});
