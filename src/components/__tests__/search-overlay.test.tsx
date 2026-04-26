import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchOverlay } from "../search-overlay";
import { useUIStore } from "@/lib/stores/ui-store";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

beforeEach(() => {
  useUIStore.setState({ isSearchOpen: true, isMenuOpen: false });
});

describe("SearchOverlay", () => {
  it("does not render when closed", () => {
    useUIStore.setState({ isSearchOpen: false });
    render(<SearchOverlay />);
    expect(screen.queryByPlaceholderText(/search products/i)).toBeNull();
  });

  it("shows results matching query", async () => {
    render(<SearchOverlay />);
    await userEvent.type(
      screen.getByPlaceholderText(/search products/i),
      "trench",
    );
    await waitFor(() =>
      expect(screen.getByText("Wool Trench Coat")).toBeInTheDocument(),
    );
  });

  it("closes when Escape pressed", async () => {
    render(<SearchOverlay />);
    await userEvent.keyboard("{Escape}");
    expect(useUIStore.getState().isSearchOpen).toBe(false);
  });
});
