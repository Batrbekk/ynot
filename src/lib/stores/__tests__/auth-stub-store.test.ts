import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStubStore } from "../auth-stub-store";

beforeEach(() => {
  useAuthStubStore.setState({ user: null });
});

describe("auth stub store", () => {
  it("starts logged out", () => {
    expect(useAuthStubStore.getState().user).toBeNull();
    expect(useAuthStubStore.getState().isAuthenticated()).toBe(false);
  });

  it("signIn stores a user (email + name)", () => {
    useAuthStubStore.getState().signIn({ email: "jane@example.com", firstName: "Jane" });
    const u = useAuthStubStore.getState().user;
    expect(u?.email).toBe("jane@example.com");
    expect(u?.firstName).toBe("Jane");
    expect(useAuthStubStore.getState().isAuthenticated()).toBe(true);
  });

  it("signOut clears the user", () => {
    useAuthStubStore.getState().signIn({ email: "x@y.z", firstName: "X" });
    useAuthStubStore.getState().signOut();
    expect(useAuthStubStore.getState().user).toBeNull();
  });
});
