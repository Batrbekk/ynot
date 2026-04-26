import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, Size } from "../schemas";

type CartState = {
  items: CartItem[];
  promoCode: string | null;
  isOpen: boolean;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, size: Size) => void;
  setQuantity: (productId: string, size: Size, quantity: number) => void;
  setPromoCode: (code: string | null) => void;
  clear: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  subtotal: () => number;
  itemCount: () => number;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      promoCode: null,
      isOpen: false,

      addItem: (incoming) =>
        set((state) => {
          const idx = state.items.findIndex(
            (i) => i.productId === incoming.productId && i.size === incoming.size,
          );
          if (idx >= 0) {
            const next = [...state.items];
            next[idx] = {
              ...next[idx],
              quantity: next[idx].quantity + incoming.quantity,
            };
            return { items: next };
          }
          return { items: [...state.items, incoming] };
        }),

      removeItem: (productId, size) =>
        set((state) => ({
          items: state.items.filter(
            (i) => !(i.productId === productId && i.size === size),
          ),
        })),

      setQuantity: (productId, size, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            return {
              items: state.items.filter(
                (i) => !(i.productId === productId && i.size === size),
              ),
            };
          }
          return {
            items: state.items.map((i) =>
              i.productId === productId && i.size === size
                ? { ...i, quantity }
                : i,
            ),
          };
        }),

      setPromoCode: (code) => set({ promoCode: code }),

      clear: () => set({ items: [], promoCode: null }),

      openDrawer: () => set({ isOpen: true }),
      closeDrawer: () => set({ isOpen: false }),

      subtotal: () =>
        get().items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),

      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: "ynot-cart",
      partialize: (state) => ({
        items: state.items,
        promoCode: state.promoCode,
      }),
    },
  ),
);
