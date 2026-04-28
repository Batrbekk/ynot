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
  // Mock /api/search to return a single fixture matching "trench" queries.
  global.fetch = vi.fn(async (url: string | URL) => {
    const q = new URL(url, "http://test").searchParams.get("q") ?? "";
    const results = q.toLowerCase().includes("trench")
      ? [
          {
            id: "p1",
            slug: "wool-trench-coat",
            name: "Wool Trench Coat",
            price: 79500,
            currency: "GBP",
            description: "Tailored wool trench.",
            images: ["/sample/trench.svg"],
            sizes: ["S", "M", "L"],
            categorySlugs: ["jackets"],
            stock: { S: 3, M: 5, L: 2 },
            preOrder: false,
            details: { materials: "Wool", care: "Dry clean", sizing: "TTS" },
          },
        ]
      : [];
    return new Response(JSON.stringify({ results }), {
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
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
