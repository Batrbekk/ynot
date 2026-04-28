"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useUIStore } from "@/lib/stores/ui-store";
import { formatPrice } from "@/lib/format";
import { duration, ease } from "@/lib/motion";
import type { Product } from "@/lib/schemas";
import { CloseIcon, SearchIcon } from "./icons";

export function SearchOverlay() {
  const open = useUIStore((s) => s.isSearchOpen);
  return (
    <AnimatePresence>{open && <SearchOverlayContent />}</AnimatePresence>
  );
}

function SearchOverlayContent() {
  const close = useUIStore((s) => s.closeSearch);
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Product[]>([]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [close]);

  React.useEffect(() => {
    let active = true;
    fetch(`/api/search?q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((data: { results: Product[] }) => {
        if (active) setResults(data.results);
      })
      .catch(() => {
        if (active) setResults([]);
      });
    return () => {
      active = false;
    };
  }, [query]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      close();
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-surface-primary text-foreground-primary overflow-y-auto"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out } }}
      exit={{ opacity: 0, y: -8, transition: { duration: duration.fast, ease: ease.out } }}
    >
      <div className="mx-auto w-full max-w-[960px] px-5 md:px-10 pt-10 pb-20">
        <div className="flex items-center justify-between mb-8">
          <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary">
            Search
          </span>
          <button
            type="button"
            onClick={close}
            aria-label="Close search"
            className="h-10 w-10 flex items-center justify-center hover:bg-surface-secondary"
          >
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={submit} className="relative">
          <SearchIcon className="absolute left-0 top-1/2 -translate-y-1/2 text-foreground-tertiary" />
          <input
            type="search"
            autoFocus
            placeholder="Search products"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full border-b border-foreground-primary bg-transparent pl-9 pr-3 py-4 font-heading text-[28px] focus:outline-none placeholder:text-foreground-tertiary"
          />
        </form>

        {results.length > 0 && (
          <ul className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-3 md:gap-8">
            {results.slice(0, 6).map((p) => (
              <li key={p.id}>
                <Link
                  href={`/products/${p.slug}`}
                  onClick={close}
                  className="group block"
                >
                  <div className="relative aspect-[3/4] w-full bg-surface-secondary overflow-hidden">
                    <Image
                      src={p.images[0]}
                      alt={p.name}
                      fill
                      sizes="(min-width: 768px) 33vw, 50vw"
                      className="object-cover"
                    />
                  </div>
                  <p className="mt-3 text-[13px] font-medium">{p.name}</p>
                  <p className="text-[13px] text-foreground-secondary">
                    {formatPrice(p.price, "GBP")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {query && results.length === 0 && (
          <p className="mt-10 text-[14px] text-foreground-secondary">
            No products match &ldquo;{query}&rdquo;.
          </p>
        )}
      </div>
    </motion.div>
  );
}
