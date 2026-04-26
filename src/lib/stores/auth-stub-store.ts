import { create } from "zustand";
import { persist } from "zustand/middleware";

interface StubUser {
  email: string;
  firstName: string;
}

interface AuthState {
  user: StubUser | null;
  signIn: (user: StubUser) => void;
  signOut: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStubStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      signIn: (user) => set({ user }),
      signOut: () => set({ user: null }),
      isAuthenticated: () => get().user !== null,
    }),
    { name: "ynot-auth-stub" },
  ),
);
