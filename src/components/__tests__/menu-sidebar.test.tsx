import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuSidebar } from "../menu-sidebar";
import { useUIStore } from "@/lib/stores/ui-store";

const categories = [
  { slug: "jackets", name: "Jackets" },
  { slug: "coats", name: "Coats" },
];

beforeEach(() => {
  useUIStore.setState({ isMenuOpen: true, isSearchOpen: false });
});

describe("MenuSidebar", () => {
  it("renders categories when open", () => {
    render(<MenuSidebar categories={categories} />);
    expect(screen.getByRole("link", { name: "Jackets" })).toHaveAttribute(
      "href",
      "/collection/jackets",
    );
    expect(screen.getByRole("link", { name: "Coats" })).toHaveAttribute(
      "href",
      "/collection/coats",
    );
  });

  it("closes when category link clicked", async () => {
    render(<MenuSidebar categories={categories} />);
    await userEvent.click(screen.getByRole("link", { name: "Jackets" }));
    expect(useUIStore.getState().isMenuOpen).toBe(false);
  });

  it("does not render when closed", () => {
    useUIStore.setState({ isMenuOpen: false });
    render(<MenuSidebar categories={categories} />);
    expect(screen.queryByRole("link", { name: "Jackets" })).toBeNull();
  });
});
