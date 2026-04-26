import * as React from "react";
import { cn } from "@/lib/cn";

const STEPS = [
  { num: 1, label: "Find order" },
  { num: 2, label: "Select items" },
  { num: 3, label: "Confirm" },
] as const;

export interface ReturnFlowProgressProps {
  current: 1 | 2 | 3;
}

export function ReturnFlowProgress({ current }: ReturnFlowProgressProps) {
  return (
    <ol className="flex items-center gap-4 md:gap-6">
      {STEPS.map((s, i) => {
        const active = current === s.num;
        const done = s.num < current;
        return (
          <React.Fragment key={s.num}>
            <li className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold",
                  active && "bg-foreground-primary text-foreground-inverse",
                  done && "bg-foreground-primary text-foreground-inverse",
                  !active && !done && "border border-border-dark text-foreground-secondary",
                )}
              >
                {done ? "✓" : s.num}
              </span>
              <span
                className={cn(
                  "text-[12px] uppercase tracking-[0.2em]",
                  active ? "text-foreground-primary" : "text-foreground-secondary",
                )}
              >
                {s.label}
              </span>
            </li>
            {i < STEPS.length - 1 && (
              <span aria-hidden className="h-px w-6 bg-border-dark md:w-12" />
            )}
          </React.Fragment>
        );
      })}
    </ol>
  );
}
