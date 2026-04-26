import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Address } from "@/lib/schemas";
import type { SavedAddress } from "@/lib/data/addresses";

let nextSeq = 100;
function nextId(): string {
  nextSeq += 1;
  return `addr_${String(nextSeq).padStart(3, "0")}`;
}

interface AddressesState {
  addresses: SavedAddress[];
  hydrate: (initial: SavedAddress[]) => void;
  addAddress: (input: { label: string; address: Address; isDefault?: boolean }) => void;
  updateAddress: (id: string, patch: { label?: string; address?: Address }) => void;
  deleteAddress: (id: string) => void;
  setDefault: (id: string) => void;
}

export const useAddressesStore = create<AddressesState>()(
  persist(
    (set, get) => ({
      addresses: [],

      hydrate: (initial) => {
        if (get().addresses.length > 0) return;
        set({ addresses: initial });
      },

      addAddress: ({ label, address, isDefault = false }) =>
        set((state) => {
          const id = nextId();
          const incoming: SavedAddress = { id, label, isDefault, address };
          if (isDefault) {
            return {
              addresses: [
                incoming,
                ...state.addresses.map((a) => ({ ...a, isDefault: false })),
              ],
            };
          }
          return { addresses: [...state.addresses, incoming] };
        }),

      updateAddress: (id, patch) =>
        set((state) => ({
          addresses: state.addresses.map((a) =>
            a.id === id
              ? {
                  ...a,
                  label: patch.label ?? a.label,
                  address: patch.address ?? a.address,
                }
              : a,
          ),
        })),

      deleteAddress: (id) =>
        set((state) => ({
          addresses: state.addresses.filter((a) => a.id !== id),
        })),

      setDefault: (id) =>
        set((state) => ({
          addresses: state.addresses.map((a) => ({
            ...a,
            isDefault: a.id === id,
          })),
        })),
    }),
    { name: "ynot-addresses" },
  ),
);
