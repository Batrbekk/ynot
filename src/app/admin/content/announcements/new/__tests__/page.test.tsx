import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AnnouncementCreateForm } from '../_components/announcement-create-form';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

describe('<AnnouncementCreateForm>', () => {
  beforeEach(() => {
    pushMock.mockReset();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi.fn();
  });

  it('on success POSTs to /api/admin/content/announcements and redirects', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'a1' }),
    });
    render(<AnnouncementCreateForm />);
    fireEvent.change(screen.getByLabelText(/text/i), {
      target: { value: 'Free UK shipping' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create announcement/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/admin/content/announcements',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/admin/content/announcements/a1');
    });
  });
});
