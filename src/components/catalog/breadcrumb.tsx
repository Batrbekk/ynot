import * as React from "react";
import Link from "next/link";

export interface BreadcrumbCrumb {
  label: string;
  href?: string;
}

export function Breadcrumb({ crumbs }: { crumbs: BreadcrumbCrumb[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="text-[12px] uppercase tracking-[0.15em] text-foreground-secondary"
    >
      <ol className="flex flex-wrap items-center gap-2">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={i} className="flex items-center gap-2">
              {c.href && !isLast ? (
                <Link href={c.href} className="hover:text-foreground-primary">
                  {c.label}
                </Link>
              ) : (
                <span className={isLast ? "text-foreground-primary" : ""}>
                  {c.label}
                </span>
              )}
              {!isLast && <span aria-hidden>/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
