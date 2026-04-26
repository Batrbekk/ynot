import * as React from "react";
import { cn } from "@/lib/cn";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label: React.ReactNode;
  error?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ label, error, className, id, ...props }, ref) {
    const reactId = React.useId();
    const inputId = id ?? reactId;
    return (
      <div className="flex flex-col gap-1">
        <label
          htmlFor={inputId}
          className={cn(
            "flex items-start gap-3 cursor-pointer select-none",
            "text-[13px] leading-snug text-foreground-primary",
            props.disabled && "cursor-not-allowed opacity-60",
            className,
          )}
        >
          <input
            ref={ref}
            id={inputId}
            type="checkbox"
            className={cn(
              "mt-0.5 h-4 w-4 appearance-none border border-border-dark",
              "rounded-none bg-surface-primary",
              "checked:bg-foreground-primary checked:border-foreground-primary",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground-primary",
              "relative",
              "before:content-[''] before:absolute before:inset-0",
              "checked:before:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><path d=%22M4 8l3 3 5-6%22 stroke=%22white%22 stroke-width=%221.5%22 fill=%22none%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/></svg>')] checked:before:bg-no-repeat checked:before:bg-center",
            )}
            aria-invalid={error ? true : undefined}
            {...props}
          />
          <span>{label}</span>
        </label>
        {error && <p className="text-[12px] text-error pl-7">{error}</p>}
      </div>
    );
  },
);
