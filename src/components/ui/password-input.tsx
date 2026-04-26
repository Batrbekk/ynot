"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ label, error, className, id, ...props }, ref) {
    const reactId = React.useId();
    const inputId = id ?? reactId;
    const [visible, setVisible] = React.useState(false);
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-secondary"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={visible ? "text" : "password"}
            aria-invalid={error ? true : undefined}
            className={cn(
              "h-[48px] w-full bg-transparent border-b border-border-light px-0 pr-12 py-3",
              "text-[14px] text-foreground-primary placeholder:text-foreground-tertiary",
              "focus:outline-none focus:border-foreground-primary rounded-none",
              error && "border-error focus:border-error",
              className,
            )}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            className="absolute right-0 top-1/2 -translate-y-1/2 px-2 text-[11px] uppercase tracking-[0.2em] text-foreground-secondary hover:text-foreground-primary"
          >
            {visible ? "Hide" : "Show"}
          </button>
        </div>
        {error && <p className="text-[12px] text-error">{error}</p>}
      </div>
    );
  },
);
