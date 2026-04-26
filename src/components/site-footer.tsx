import Link from "next/link";
import { cn } from "@/lib/cn";
import { InstagramIcon } from "./icons";

interface FooterLink {
  label: string;
  href: string;
}

interface FooterColumn {
  title?: string;
  links: FooterLink[];
}

const COLUMNS: FooterColumn[] = [
  {
    title: "About",
    links: [
      { label: "Our Story", href: "/our-story" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Customer Care",
    links: [
      { label: "Shipping and Returns", href: "/shipping-returns" },
      { label: "Initiate a Return", href: "/initiate-return" },
      { label: "Privacy Policy", href: "/privacy" },
    ],
  },
  {
    title: "Product",
    links: [
      { label: "Product Care", href: "/product-care" },
      { label: "General Sizing", href: "/sizing" },
      { label: "Sustainability", href: "/sustainability" },
    ],
  },
];

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "border-t border-border-light bg-surface-primary text-foreground-primary",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-[1440px] px-5 py-16 md:px-10 md:py-24">
        <div className="grid gap-12 md:grid-cols-4 md:gap-8">
          {COLUMNS.map((col) => (
            <div key={col.title} className="flex flex-col gap-4">
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary">
                {col.title}
              </h4>
              <ul className="flex flex-col gap-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[13px] text-foreground-primary transition-colors hover:text-foreground-secondary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="flex flex-col gap-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary">
              Follow
            </h4>
            <a
              href="https://instagram.com/ynotlondon"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="inline-flex h-10 w-10 items-center justify-center text-foreground-primary transition-colors hover:text-foreground-secondary"
            >
              <InstagramIcon />
            </a>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-border-light pt-8 md:flex-row md:items-center">
          <p className="text-[11px] uppercase tracking-[0.2em] text-foreground-tertiary">
            © {new Date().getFullYear()} YNOT London. All rights reserved.
          </p>
          <p className="text-[11px] uppercase tracking-[0.2em] text-foreground-tertiary">
            Designed in London · Made in London &amp; Istanbul
          </p>
        </div>
      </div>
    </footer>
  );
}
