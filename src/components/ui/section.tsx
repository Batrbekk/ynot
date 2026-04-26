import * as React from "react";
import { cn } from "@/lib/cn";

type SectionPadding = "none" | "sm" | "md" | "lg";
type SectionBackground = "white" | "cream" | "dark";

const padding: Record<SectionPadding, string> = {
  none: "py-0",
  sm: "py-12",
  md: "py-16 md:py-20",
  lg: "py-24 md:py-32",
};

const background: Record<SectionBackground, string> = {
  white: "bg-surface-primary text-foreground-primary",
  cream: "bg-surface-secondary text-foreground-on-cream",
  dark: "bg-surface-dark text-foreground-inverse",
};

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  padding?: SectionPadding;
  background?: SectionBackground;
}

export function Section({
  className,
  padding: p = "md",
  background: b = "white",
  ...props
}: SectionProps) {
  return (
    <section
      className={cn(padding[p], background[b], className)}
      {...props}
    />
  );
}
