import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "../ui-store";

beforeEach(() => {
  useUIStore.setState({ isMenuOpen: false, isSearchOpen: false });
});

describe("ui store", () => {
  it("starts with menu and search closed", () => {
    expect(useUIStore.getState().isMenuOpen).toBe(false);
    expect(useUIStore.getState().isSearchOpen).toBe(false);
  });

  it("openMenu sets isMenuOpen true and closes search", () => {
    useUIStore.setState({ isSearchOpen: true });
    useUIStore.getState().openMenu();
    expect(useUIStore.getState().isMenuOpen).toBe(true);
    expect(useUIStore.getState().isSearchOpen).toBe(false);
  });

  it("openSearch sets isSearchOpen true and closes menu", () => {
    useUIStore.setState({ isMenuOpen: true });
    useUIStore.getState().openSearch();
    expect(useUIStore.getState().isSearchOpen).toBe(true);
    expect(useUIStore.getState().isMenuOpen).toBe(false);
  });

  it("closeAll closes everything", () => {
    useUIStore.setState({ isMenuOpen: true, isSearchOpen: true });
    useUIStore.getState().closeAll();
    expect(useUIStore.getState().isMenuOpen).toBe(false);
    expect(useUIStore.getState().isSearchOpen).toBe(false);
  });
});
