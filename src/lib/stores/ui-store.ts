import { create } from "zustand";

type UIState = {
  isMenuOpen: boolean;
  isSearchOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  closeAll: () => void;
};

export const useUIStore = create<UIState>()((set) => ({
  isMenuOpen: false,
  isSearchOpen: false,
  openMenu: () => set({ isMenuOpen: true, isSearchOpen: false }),
  closeMenu: () => set({ isMenuOpen: false }),
  openSearch: () => set({ isSearchOpen: true, isMenuOpen: false }),
  closeSearch: () => set({ isSearchOpen: false }),
  closeAll: () => set({ isMenuOpen: false, isSearchOpen: false }),
}));
