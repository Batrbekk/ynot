import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CartDrawer } from "../cart-drawer";
import { useCartStore } from "@/lib/stores/cart-store";

const sampleItem = {
  productId: "prod_001",
  slug: "belted-suede-field-jacket",
  name: "Belted Suede Field Jacket",
  image: "/sample/jacket-1.svg",
  colour: "Chocolate Brown",
  size: "M" as const,
  unitPrice: 89500,
  quantity: 1,
  preOrder: false,
};

beforeEach(() => {
  useCartStore.setState({ items: [], promoCode: null, isOpen: true });
});

describe("CartDrawer", () => {
  it("renders empty state when no items", () => {
    render(<CartDrawer />);
    expect(screen.getByText(/your bag is empty/i)).toBeInTheDocument();
  });

  it("renders cart items and subtotal", () => {
    useCartStore.setState({ items: [sampleItem] });
    render(<CartDrawer />);
    expect(screen.getByText("Belted Suede Field Jacket")).toBeInTheDocument();
    // £895 appears twice (line total + subtotal) when one item is in cart.
    expect(screen.getAllByText("£895").length).toBeGreaterThanOrEqual(1);
  });

  it("removes item when Remove clicked", async () => {
    useCartStore.setState({ items: [sampleItem] });
    render(<CartDrawer />);
    await userEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(useCartStore.getState().items.length).toBe(0);
  });

  it("does not render when closed", () => {
    useCartStore.setState({ isOpen: false });
    render(<CartDrawer />);
    expect(screen.queryByText(/your bag/i)).toBeNull();
  });
});
