"use client";

import { CartDrawer } from "./cart-drawer";
import { MenuSidebar } from "./menu-sidebar";
import { SearchOverlay } from "./search-overlay";

interface MenuCategory {
  slug: string;
  name: string;
}

export function SiteOverlays({ categories }: { categories: MenuCategory[] }) {
  return (
    <>
      <MenuSidebar categories={categories} />
      <CartDrawer />
      <SearchOverlay />
    </>
  );
}
