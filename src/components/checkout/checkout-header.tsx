import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import logoBlack from "../../../public/brand/ynot-logo-black.png";

export function CheckoutHeader() {
  return (
    <header className="w-full border-b border-border-light bg-surface-primary">
      <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between px-5 md:px-10">
        <span className="text-[11px] uppercase tracking-[0.25em] text-foreground-secondary">
          Secure checkout
        </span>
        <Link href="/" aria-label="YNOT London" className="relative block h-8 w-[64px]">
          <Image src={logoBlack} alt="YNOT London" fill sizes="80px" priority className="object-contain" />
        </Link>
        <span className="text-[11px] uppercase tracking-[0.25em] text-foreground-secondary">
          256-bit SSL
        </span>
      </div>
    </header>
  );
}
