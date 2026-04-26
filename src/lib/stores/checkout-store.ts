import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Address, Carrier, Order } from "@/lib/schemas";
import { useCartStore } from "./cart-store";
import { generateOrderId } from "@/lib/checkout/format-order-id";

interface CheckoutState {
  shippingAddress: Address | null;
  shippingMethod: Carrier | null;
  placedOrder: Order | null;

  setShipping: (address: Address, method: Carrier) => void;
  placeOrder: () => string | null;
  getPlacedOrderById: (id: string) => Order | null;
  reset: () => void;
}

function estimatedDeliveryDate(carrier: Carrier): string {
  const days = carrier === "royal-mail" ? 3 : 9;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const useCheckoutStore = create<CheckoutState>()(
  persist(
    (set, get) => ({
      shippingAddress: null,
      shippingMethod: null,
      placedOrder: null,

      setShipping: (address, method) =>
        set({ shippingAddress: address, shippingMethod: method }),

      placeOrder: () => {
        const { shippingAddress, shippingMethod } = get();
        const cart = useCartStore.getState();
        if (!shippingAddress || !shippingMethod) return null;
        if (cart.items.length === 0) return null;

        const subtotal = cart.subtotal();
        const id = generateOrderId(new Date(), Math.floor(Math.random() * 9999));
        const order: Order = {
          id,
          createdAt: new Date().toISOString(),
          status: "new",
          items: cart.items,
          subtotal,
          shipping: 0,
          total: subtotal,
          currency: "GBP",
          carrier: shippingMethod,
          trackingNumber: null,
          shippingAddress,
          estimatedDeliveryDate: estimatedDeliveryDate(shippingMethod),
        };

        set({ placedOrder: order });
        cart.clear();
        return id;
      },

      getPlacedOrderById: (id) => {
        const order = get().placedOrder;
        return order && order.id === id ? order : null;
      },

      reset: () =>
        set({
          shippingAddress: null,
          shippingMethod: null,
          placedOrder: null,
        }),
    }),
    {
      name: "ynot-checkout",
      partialize: (state) => ({
        shippingAddress: state.shippingAddress,
        shippingMethod: state.shippingMethod,
        placedOrder: state.placedOrder,
      }),
    },
  ),
);
