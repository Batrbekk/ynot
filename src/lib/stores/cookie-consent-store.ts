import { create } from "zustand";
import { persist } from "zustand/middleware";

type Status = "pending" | "accepted" | "declined";

interface ConsentState {
  status: Status;
  accept: () => void;
  decline: () => void;
  isResolved: () => boolean;
}

export const useCookieConsentStore = create<ConsentState>()(
  persist(
    (set, get) => ({
      status: "pending",
      accept: () => set({ status: "accepted" }),
      decline: () => set({ status: "declined" }),
      isResolved: () => get().status !== "pending",
    }),
    { name: "ynot-cookie-consent" },
  ),
);
