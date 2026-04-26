import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import logoBlack from "../../../public/brand/ynot-logo-black.png";

export function AuthHeader() {
  return (
    <header className="w-full border-b border-border-light bg-surface-primary">
      <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-center px-5 md:px-10">
        <Link href="/" aria-label="YNOT London" className="relative block h-8 w-[64px]">
          <Image
            src={logoBlack}
            alt="YNOT London"
            fill
            sizes="80px"
            priority
            className="object-contain"
          />
        </Link>
      </div>
    </header>
  );
}
