import { describe, expect, it } from 'vitest';
import { requireOwner, AuthorizationError } from '../guards';

describe('requireOwner', () => {
  it('throws AuthorizationError when session is null', () => {
    expect(() => requireOwner(null)).toThrow(AuthorizationError);
  });

  it('throws AuthorizationError when role is not OWNER', () => {
    expect(() =>
      requireOwner({ user: { id: 'u1', role: 'ADMIN' } } as any),
    ).toThrow(AuthorizationError);
    expect(() =>
      requireOwner({ user: { id: 'u1', role: 'CUSTOMER' } } as any),
    ).toThrow(AuthorizationError);
    expect(() =>
      requireOwner({ user: { id: 'u1', role: 'EDITOR' } } as any),
    ).toThrow(AuthorizationError);
  });

  it('returns the session when role is OWNER', () => {
    const session = { user: { id: 'u1', role: 'OWNER' } } as any;
    expect(requireOwner(session)).toBe(session);
  });
});
