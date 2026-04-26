import { create } from "zustand";

interface ReturnsState {
  orderId: string | null;
  selectedItems: string[];
  reason: string;
  setOrder: (id: string) => void;
  toggleItem: (id: string) => void;
  setReason: (reason: string) => void;
  reset: () => void;
}

export const useReturnsStubStore = create<ReturnsState>()((set) => ({
  orderId: null,
  selectedItems: [],
  reason: "",

  setOrder: (id) => set({ orderId: id, selectedItems: [], reason: "" }),

  toggleItem: (id) =>
    set((state) => ({
      selectedItems: state.selectedItems.includes(id)
        ? state.selectedItems.filter((x) => x !== id)
        : [...state.selectedItems, id],
    })),

  setReason: (reason) => set({ reason }),

  reset: () => set({ orderId: null, selectedItems: [], reason: "" }),
}));
