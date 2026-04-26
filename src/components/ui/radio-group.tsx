import * as React from "react";
import { cn } from "@/lib/cn";

export interface RadioOption {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
}

export interface RadioGroupProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: RadioOption[];
  className?: string;
}

export function RadioGroup({
  name,
  value,
  onChange,
  options,
  className,
}: RadioGroupProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)} role="radiogroup">
      {options.map((opt) => {
        const id = `${name}-${opt.value}`;
        const checked = value === opt.value;
        return (
          <label
            key={opt.value}
            htmlFor={id}
            className={cn(
              "flex items-start gap-3 cursor-pointer p-4 border",
              checked
                ? "border-foreground-primary bg-surface-secondary"
                : "border-border-light bg-surface-primary",
              "transition-colors",
            )}
          >
            <input
              id={id}
              type="radio"
              name={name}
              value={opt.value}
              checked={checked}
              onChange={() => onChange(opt.value)}
              className={cn(
                "mt-0.5 h-4 w-4 appearance-none rounded-full border border-border-dark",
                "checked:bg-foreground-primary checked:border-foreground-primary",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground-primary",
                "relative",
                "checked:after:content-[''] checked:after:absolute checked:after:inset-1 checked:after:bg-surface-primary checked:after:rounded-full",
              )}
            />
            <div className="flex flex-col gap-1">
              <span className="text-[13px] font-medium text-foreground-primary">
                {opt.label}
              </span>
              {opt.description && (
                <span className="text-[12px] text-foreground-secondary">
                  {opt.description}
                </span>
              )}
            </div>
          </label>
        );
      })}
    </div>
  );
}
