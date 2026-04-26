"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface TabItem {
  value: string;
  label: React.ReactNode;
  content: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export function Tabs({
  items,
  defaultValue,
  value,
  onValueChange,
  className,
}: TabsProps) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState(
    defaultValue ?? items[0]?.value,
  );
  const active = isControlled ? value! : internal;

  const setActive = (v: string) => {
    if (!isControlled) setInternal(v);
    onValueChange?.(v);
  };

  return (
    <div className={className}>
      <div role="tablist" className="flex gap-6 border-b border-border-light">
        {items.map((it) => {
          const selected = it.value === active;
          return (
            <button
              key={it.value}
              role="tab"
              aria-selected={selected}
              type="button"
              onClick={() => setActive(it.value)}
              className={cn(
                "py-3 text-[12px] font-semibold uppercase tracking-[0.2em]",
                "border-b-2 -mb-px transition-colors",
                selected
                  ? "border-foreground-primary text-foreground-primary"
                  : "border-transparent text-foreground-secondary hover:text-foreground-primary",
              )}
            >
              {it.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="pt-6">
        {items.find((it) => it.value === active)?.content}
      </div>
    </div>
  );
}
