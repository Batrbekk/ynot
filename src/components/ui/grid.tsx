import * as React from "react";
import { cn } from "@/lib/cn";

export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 1 | 2 | 3 | 4;
  /** Mobile cols override (default 1 for cols 2-4, 1 for cols 1) */
  mobileCols?: 1 | 2;
  gap?: "sm" | "md" | "lg";
}

const colMap = {
  1: "grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
};

const mobileMap = {
  1: "grid-cols-1",
  2: "grid-cols-2",
};

const gapMap = {
  sm: "gap-3",
  md: "gap-6",
  lg: "gap-8 md:gap-10",
};

export function Grid({
  cols = 4,
  mobileCols = 2,
  gap = "md",
  className,
  ...props
}: GridProps) {
  return (
    <div
      className={cn("grid", mobileMap[mobileCols], colMap[cols], gapMap[gap], className)}
      {...props}
    />
  );
}
