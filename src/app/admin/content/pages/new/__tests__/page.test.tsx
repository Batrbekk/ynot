import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StaticPageCreateForm } from '../_components/static-page-create-form';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

describe('<StaticPageCreateForm>', () => {
  beforeEach(() => {
    pushMock.mockReset();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi.fn();
  });

  it('on success POSTs to /api/admin/content/pages and redirects', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'p1' }),
    });
    render(<StaticPageCreateForm />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'About' } });
    fireEvent.click(screen.getByRole('button', { name: /create page/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/admin/content/pages',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/admin/content/pages/p1');
    });
  });
});
