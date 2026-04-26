import * as React from "react";
import { cn } from "@/lib/cn";

export interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  className,
}: QuantityStepperProps) {
  const dec = () => value > min && onChange(value - 1);
  const inc = () => value < max && onChange(value + 1);
  return (
    <div
      className={cn(
        "inline-flex items-center border border-border-light",
        className,
      )}
    >
      <button
        type="button"
        onClick={dec}
        disabled={value <= min}
        aria-label="Decrease quantity"
        className="h-9 w-9 flex items-center justify-center text-foreground-primary hover:bg-surface-secondary disabled:opacity-30 disabled:cursor-not-allowed"
      >
        −
      </button>
      <span className="min-w-[36px] text-center text-[13px] tabular-nums">
        {value}
      </span>
      <button
        type="button"
        onClick={inc}
        disabled={value >= max}
        aria-label="Increase quantity"
        className="h-9 w-9 flex items-center justify-center text-foreground-primary hover:bg-surface-secondary disabled:opacity-30 disabled:cursor-not-allowed"
      >
        +
      </button>
    </div>
  );
}
