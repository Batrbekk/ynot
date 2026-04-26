import * as React from "react";
import { cn } from "@/lib/cn";

type ContainerSize = "default" | "narrow" | "wide" | "full";

const sizeStyles: Record<ContainerSize, string> = {
  narrow: "max-w-[800px]",
  default: "max-w-[1280px]",
  wide: "max-w-[1440px]",
  full: "max-w-none",
};

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: ContainerSize;
  as?: keyof React.JSX.IntrinsicElements;
}

export function Container({
  size = "default",
  as: Tag = "div",
  className,
  ...props
}: ContainerProps) {
  const Component = Tag as React.ElementType;
  return (
    <Component
      className={cn(
        "mx-auto w-full px-5 md:px-10",
        sizeStyles[size],
        className,
      )}
      {...props}
    />
  );
}
