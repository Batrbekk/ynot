import { describe, it, expect, beforeEach } from "vitest";
import { useCheckoutStore } from "../checkout-store";
import { useCartStore } from "../cart-store";
import type { Address } from "@/lib/schemas";

const addr: Address = {
  firstName: "Jane",
  lastName: "Doe",
  line1: "42 King's Road",
  line2: null,
  city: "London",
  postcode: "SW3 4ND",
  country: "GB",
  phone: "+44 7700 900123",
};

const item = {
  productId: "p1",
  slug: "p1",
  name: "Test",
  image: "/x.jpg",
  colour: "Black",
  size: "M" as const,
  unitPrice: 50000,
  quantity: 1,
  preOrder: false,
};

beforeEach(() => {
  useCheckoutStore.setState({
    shippingAddress: null,
    shippingMethod: null,
    placedOrder: null,
  });
  useCartStore.setState({ items: [], promoCode: null, isOpen: false });
});

describe("checkout store", () => {
  it("starts empty", () => {
    const s = useCheckoutStore.getState();
    expect(s.shippingAddress).toBeNull();
    expect(s.shippingMethod).toBeNull();
    expect(s.placedOrder).toBeNull();
  });

  it("setShipping stores address and method", () => {
    useCheckoutStore.getState().setShipping(addr, "royal-mail");
    const s = useCheckoutStore.getState();
    expect(s.shippingAddress?.firstName).toBe("Jane");
    expect(s.shippingMethod).toBe("royal-mail");
  });

  it("placeOrder snapshots cart + shipping, clears cart, returns id", () => {
    useCartStore.getState().addItem(item);
    useCheckoutStore.getState().setShipping(addr, "dhl");
    const id = useCheckoutStore.getState().placeOrder();
    expect(id).toMatch(/^YNT-\d{8}-\d{4}$/);
    const s = useCheckoutStore.getState();
    expect(s.placedOrder?.id).toBe(id);
    expect(s.placedOrder?.items.length).toBe(1);
    expect(s.placedOrder?.carrier).toBe("dhl");
    expect(s.placedOrder?.shippingAddress.firstName).toBe("Jane");
    // cart cleared
    expect(useCartStore.getState().items.length).toBe(0);
  });

  it("placeOrder returns null when no shipping address set", () => {
    useCartStore.getState().addItem(item);
    const id = useCheckoutStore.getState().placeOrder();
    expect(id).toBeNull();
  });

  it("placeOrder returns null when cart is empty", () => {
    useCheckoutStore.getState().setShipping(addr, "royal-mail");
    const id = useCheckoutStore.getState().placeOrder();
    expect(id).toBeNull();
  });

  it("getPlacedOrderById returns the snapshot", () => {
    useCartStore.getState().addItem(item);
    useCheckoutStore.getState().setShipping(addr, "royal-mail");
    const id = useCheckoutStore.getState().placeOrder()!;
    const order = useCheckoutStore.getState().getPlacedOrderById(id);
    expect(order?.id).toBe(id);
  });

  it("reset clears the store", () => {
    useCartStore.getState().addItem(item);
    useCheckoutStore.getState().setShipping(addr, "royal-mail");
    useCheckoutStore.getState().placeOrder();
    useCheckoutStore.getState().reset();
    expect(useCheckoutStore.getState().placedOrder).toBeNull();
  });
});
