"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  AccountIcon,
  BagIcon,
  MenuIcon,
  SearchIcon,
} from "./icons";

import logoBlack from "../../public/brand/ynot-logo-black.png";
import logoWhite from "../../public/brand/ynot-logo-white.png";

export interface SiteHeaderProps {
  /**
   * When true, header starts transparent over a hero image and becomes solid
   * after the user scrolls past the hero.
   */
  overHero?: boolean;
  cartCount?: number;
}

export function SiteHeader({ overHero = false, cartCount = 0 }: SiteHeaderProps) {
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    if (!overHero) return;
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [overHero]);

  const isTransparent = overHero && !scrolled;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full transition-colors duration-300",
        isTransparent
          ? "bg-transparent text-foreground-inverse"
          : "bg-surface-primary text-foreground-primary border-b border-border-light",
      )}
    >
      <div className="grid h-12 grid-cols-3 items-center px-5 md:h-14 md:px-8">
        <div className="flex items-center">
          <button
            type="button"
            aria-label="Open menu"
            className="-ml-2 flex h-10 w-10 items-center justify-center"
          >
            <MenuIcon />
          </button>
        </div>

        <div className="flex items-center justify-center">
          <Link href="/" aria-label="YNOT London" className="relative block h-8 w-[56px] md:h-9 md:w-[64px]">
            <Image
              src={logoWhite}
              alt=""
              priority
              fill
              sizes="100px"
              className={cn(
                "object-contain transition-opacity duration-300",
                isTransparent ? "opacity-100" : "opacity-0",
              )}
            />
            <Image
              src={logoBlack}
              alt="YNOT London"
              priority
              fill
              sizes="100px"
              className={cn(
                "object-contain transition-opacity duration-300",
                isTransparent ? "opacity-0" : "opacity-100",
              )}
            />
          </Link>
        </div>

        <div className="flex items-center justify-end gap-1 md:gap-2">
          <button
            type="button"
            aria-label="Search"
            className="hidden h-10 w-10 items-center justify-center md:flex"
          >
            <SearchIcon />
          </button>
          <Link
            href="/account"
            aria-label="Account"
            className="hidden h-10 w-10 items-center justify-center md:flex"
          >
            <AccountIcon />
          </Link>
          <button
            type="button"
            aria-label={`Cart, ${cartCount} items`}
            className="relative -mr-2 flex h-10 w-10 items-center justify-center"
          >
            <BagIcon />
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground-primary px-1 text-[10px] font-semibold text-foreground-inverse">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
