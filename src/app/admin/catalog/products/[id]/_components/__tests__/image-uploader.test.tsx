import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImageUploader } from '../image-uploader';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe('<ImageUploader>', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi.fn();
  });

  it('renders drop zone', () => {
    render(<ImageUploader productId="p1" />);
    expect(screen.getByTestId('image-uploader')).toBeInTheDocument();
    expect(screen.getByText(/choose files/i)).toBeInTheDocument();
  });

  it('uploads file then attaches URL to product', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchMock = globalThis.fetch as any;
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          uploaded: [{ key: 'k', url: 'http://x/img.jpg', originalFilename: 'f.jpg' }],
          rejected: [],
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'i1' }] });

    render(<ImageUploader productId="p1" />);
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    expect(fetchMock.mock.calls[0][0]).toContain('/api/admin/media/upload?prefix=products/p1');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/admin/products/p1/images');
  });
});
