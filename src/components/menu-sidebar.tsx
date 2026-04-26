"use client";

import * as React from "react";
import Link from "next/link";
import { Drawer } from "@/components/ui/drawer";
import { useUIStore } from "@/lib/stores/ui-store";

interface MenuCategory {
  slug: string;
  name: string;
}

export interface MenuSidebarProps {
  categories: MenuCategory[];
}

export function MenuSidebar({ categories }: MenuSidebarProps) {
  const isOpen = useUIStore((s) => s.isMenuOpen);
  const close = useUIStore((s) => s.closeMenu);

  return (
    <Drawer open={isOpen} onClose={close} side="left" title="Menu">
      <nav className="flex flex-col p-6">
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/collection/${c.slug}`}
            onClick={close}
            className="py-3 font-heading text-[24px] text-foreground-primary hover:text-foreground-secondary transition-colors"
          >
            {c.name}
          </Link>
        ))}
      </nav>
    </Drawer>
  );
}
