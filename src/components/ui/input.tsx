import * as React from "react";
import { cn } from "@/lib/cn";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, label, error, hint, id, ...props }, ref) {
    const reactId = React.useId();
    const inputId = id ?? reactId;

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
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
          }
          className={cn(
            "h-[48px] w-full bg-transparent border-b border-border-light px-0 py-3",
            "text-[14px] text-foreground-primary placeholder:text-foreground-tertiary",
            "transition-colors focus:outline-none focus:border-foreground-primary",
            "rounded-none",
            error && "border-error focus:border-error",
            className,
          )}
          {...props}
        />
        {error ? (
          <p
            id={`${inputId}-error`}
            className="text-[12px] text-error"
            role="alert"
          >
            {error}
          </p>
        ) : hint ? (
          <p
            id={`${inputId}-hint`}
            className="text-[12px] text-foreground-tertiary"
          >
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
