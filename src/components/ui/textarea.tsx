import * as React from "react";
import { cn } from "@/lib/cn";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, error, className, id, rows = 4, ...props }, ref) {
    const reactId = React.useId();
    const taId = id ?? reactId;
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label
            htmlFor={taId}
            className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-secondary"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={taId}
          rows={rows}
          aria-invalid={error ? true : undefined}
          className={cn(
            "w-full bg-transparent border border-border-light p-3",
            "text-[14px] text-foreground-primary placeholder:text-foreground-tertiary",
            "focus:outline-none focus:border-foreground-primary",
            "rounded-none resize-y",
            error && "border-error focus:border-error",
            className,
          )}
          {...props}
        />
        {error && <p className="text-[12px] text-error">{error}</p>}
      </div>
    );
  },
);
