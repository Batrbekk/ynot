import { describe, expect, it, vi } from 'vitest';
import { isAdminRole } from '../admin';

vi.mock('../session', () => ({
  getSessionUser: vi.fn(),
}));

import { getSessionUser } from '../session';
import { requireAdmin } from '../admin';

describe('isAdminRole', () => {
  it('accepts ADMIN and OWNER', () => {
    expect(isAdminRole('ADMIN')).toBe(true);
    expect(isAdminRole('OWNER')).toBe(true);
  });
  it('rejects others', () => {
    expect(isAdminRole('CUSTOMER')).toBe(false);
    expect(isAdminRole('EDITOR')).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
    expect(isAdminRole(null)).toBe(false);
  });
});

describe('requireAdmin', () => {
  it('throws 401 when no session', async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce(null);
    await expect(requireAdmin()).rejects.toMatchObject({
      message: 'UNAUTHENTICATED',
      status: 401,
    });
  });

  it('throws 403 when role is not admin', async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({
      id: 'u1', email: 'c@x.com', name: null, role: 'CUSTOMER', emailVerifiedAt: null,
    });
    await expect(requireAdmin()).rejects.toMatchObject({
      message: 'FORBIDDEN',
      status: 403,
    });
  });

  it('returns the user when role is admin', async () => {
    const u = {
      id: 'u2', email: 'a@x.com', name: 'A', role: 'ADMIN' as const, emailVerifiedAt: new Date(),
    };
    vi.mocked(getSessionUser).mockResolvedValueOnce(u);
    await expect(requireAdmin()).resolves.toEqual(u);
  });
});
