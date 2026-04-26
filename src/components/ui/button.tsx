import * as React from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "outline" | "ghost" | "link";
type Size = "lg" | "md" | "sm";

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-cta-bg text-cta-text hover:bg-foreground-secondary active:bg-black",
  outline:
    "bg-cta-outline-bg text-cta-outline-text border border-foreground-primary hover:bg-foreground-primary hover:text-cta-text",
  ghost:
    "bg-transparent text-foreground-primary hover:bg-surface-secondary",
  link:
    "bg-transparent text-foreground-primary underline underline-offset-4 hover:text-foreground-secondary px-0 h-auto tracking-normal normal-case font-normal",
};

const sizeStyles: Record<Size, string> = {
  lg: "h-[52px] px-8 text-[14px]",
  md: "h-[48px] px-6 text-[13px]",
  sm: "h-[44px] px-5 text-[12px]",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "primary",
      size = "lg",
      fullWidth,
      type = "button",
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center font-body font-semibold uppercase tracking-[0.15em]",
          "transition-colors duration-200 ease-out",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground-primary",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "rounded-none whitespace-nowrap",
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && "w-full",
          className,
        )}
        {...props}
      />
    );
  },
);
