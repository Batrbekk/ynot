import * as React from "react";
import { cn } from "@/lib/cn";

type DisplayLevel = "xl" | "lg" | "md" | "sm";

const displaySizes: Record<DisplayLevel, string> = {
  xl: "text-[80px] leading-[0.95] md:text-[120px]",
  lg: "text-[48px] leading-tight md:text-[56px]",
  md: "text-[32px] leading-tight md:text-[36px]",
  sm: "text-[22px] leading-snug md:text-[24px]",
};

export interface DisplayProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: DisplayLevel;
  as?: "h1" | "h2" | "h3" | "h4" | "p";
}

export function Display({
  level = "lg",
  as: Tag = "h2",
  className,
  ...props
}: DisplayProps) {
  const Component = Tag as React.ElementType;
  return (
    <Component
      className={cn(
        "font-heading font-normal text-foreground-primary",
        "tracking-[-0.01em]",
        displaySizes[level],
        className,
      )}
      {...props}
    />
  );
}

export interface EyebrowProps extends React.HTMLAttributes<HTMLSpanElement> {
  as?: "span" | "p" | "div";
}

export function Eyebrow({ as: Tag = "span", className, ...props }: EyebrowProps) {
  const Component = Tag as React.ElementType;
  return (
    <Component
      className={cn(
        "font-body text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary",
        className,
      )}
      {...props}
    />
  );
}
