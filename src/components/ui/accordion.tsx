"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface AccordionItem {
  value: string;
  title: React.ReactNode;
  content: React.ReactNode;
}

export interface AccordionProps {
  items: AccordionItem[];
  /** When true, multiple items can be open at once. Default false. */
  multiple?: boolean;
  className?: string;
}

export function Accordion({
  items,
  multiple = false,
  className,
}: AccordionProps) {
  const [open, setOpen] = React.useState<string[]>([]);

  const toggle = (value: string) => {
    setOpen((prev) => {
      if (prev.includes(value)) return prev.filter((v) => v !== value);
      if (multiple) return [...prev, value];
      return [value];
    });
  };

  return (
    <div className={cn("border-t border-border-light", className)}>
      {items.map((it) => {
        const isOpen = open.includes(it.value);
        return (
          <div key={it.value} className="border-b border-border-light">
            <button
              type="button"
              onClick={() => toggle(it.value)}
              aria-expanded={isOpen}
              className={cn(
                "w-full flex items-center justify-between py-5",
                "text-left text-[13px] font-semibold uppercase tracking-[0.15em] text-foreground-primary",
              )}
            >
              <span>{it.title}</span>
              <span aria-hidden className="text-[18px] font-light">
                {isOpen ? "−" : "+"}
              </span>
            </button>
            {isOpen && (
              <div className="pb-5 text-[14px] leading-relaxed text-foreground-secondary">
                {it.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
