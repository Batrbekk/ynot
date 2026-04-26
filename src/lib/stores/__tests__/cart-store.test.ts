import { describe, it, expect, beforeEach } from "vitest";
import { useCartStore } from "../cart-store";

const item = (overrides: Partial<{ size: "S" | "M"; quantity: number }> = {}) => ({
  productId: "prod_001",
  slug: "belted-suede-field-jacket",
  name: "Belted Suede Field Jacket",
  image: "/sample/jacket-1.svg",
  colour: "Chocolate Brown",
  size: overrides.size ?? "M",
  unitPrice: 89500,
  quantity: overrides.quantity ?? 1,
  preOrder: false,
} as const);

beforeEach(() => {
  useCartStore.setState({ items: [], promoCode: null, isOpen: false });
});

describe("cart store", () => {
  it("addItem adds new item", () => {
    useCartStore.getState().addItem(item());
    expect(useCartStore.getState().items.length).toBe(1);
  });

  it("addItem increments quantity if same productId+size", () => {
    useCartStore.getState().addItem(item({ size: "M", quantity: 1 }));
    useCartStore.getState().addItem(item({ size: "M", quantity: 2 }));
    const items = useCartStore.getState().items;
    expect(items.length).toBe(1);
    expect(items[0].quantity).toBe(3);
  });

  it("addItem with different size creates separate line", () => {
    useCartStore.getState().addItem(item({ size: "S" }));
    useCartStore.getState().addItem(item({ size: "M" }));
    expect(useCartStore.getState().items.length).toBe(2);
  });

  it("removeItem removes by productId+size", () => {
    useCartStore.getState().addItem(item({ size: "S" }));
    useCartStore.getState().addItem(item({ size: "M" }));
    useCartStore.getState().removeItem("prod_001", "S");
    const items = useCartStore.getState().items;
    expect(items.length).toBe(1);
    expect(items[0].size).toBe("M");
  });

  it("setQuantity updates an existing line", () => {
    useCartStore.getState().addItem(item({ size: "M" }));
    useCartStore.getState().setQuantity("prod_001", "M", 5);
    expect(useCartStore.getState().items[0].quantity).toBe(5);
  });

  it("setQuantity to 0 removes the line", () => {
    useCartStore.getState().addItem(item({ size: "M" }));
    useCartStore.getState().setQuantity("prod_001", "M", 0);
    expect(useCartStore.getState().items.length).toBe(0);
  });

  it("clear empties the cart", () => {
    useCartStore.getState().addItem(item());
    useCartStore.getState().clear();
    expect(useCartStore.getState().items).toEqual([]);
  });

  it("subtotal sums unitPrice * quantity", () => {
    useCartStore.getState().addItem(item({ size: "M", quantity: 2 }));
    useCartStore.getState().addItem(item({ size: "S", quantity: 1 }));
    expect(useCartStore.getState().subtotal()).toBe(89500 * 3);
  });

  it("itemCount sums quantities", () => {
    useCartStore.getState().addItem(item({ size: "M", quantity: 2 }));
    useCartStore.getState().addItem(item({ size: "S", quantity: 3 }));
    expect(useCartStore.getState().itemCount()).toBe(5);
  });

  it("openDrawer + closeDrawer toggle isOpen", () => {
    useCartStore.getState().openDrawer();
    expect(useCartStore.getState().isOpen).toBe(true);
    useCartStore.getState().closeDrawer();
    expect(useCartStore.getState().isOpen).toBe(false);
  });
});
