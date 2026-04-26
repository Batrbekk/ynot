import * as React from "react";
import { cn } from "@/lib/cn";

export interface ColourSwatchProps {
  name: string;
  hex: string;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function ColourSwatch({
  name,
  hex,
  selected,
  onClick,
  className,
}: ColourSwatchProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${name}${selected ? ", selected" : ""}`}
      aria-pressed={selected}
      className={cn(
        "h-9 w-9 rounded-full border-2",
        selected ? "border-foreground-primary" : "border-border-light",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground-primary",
        className,
      )}
      style={{ backgroundColor: hex }}
    />
  );
}
