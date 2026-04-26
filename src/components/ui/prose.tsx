import * as React from "react";
import { cn } from "@/lib/cn";

export interface ProseProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Prose({ className, ...props }: ProseProps) {
  return (
    <div
      className={cn(
        "max-w-prose text-[15px] leading-relaxed text-foreground-primary",
        "[&_h1]:font-heading [&_h1]:text-[36px] [&_h1]:mt-12 [&_h1]:mb-4",
        "[&_h2]:font-heading [&_h2]:text-[28px] [&_h2]:mt-10 [&_h2]:mb-3",
        "[&_h3]:font-heading [&_h3]:text-[20px] [&_h3]:mt-8 [&_h3]:mb-2",
        "[&_p]:mb-4",
        "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4",
        "[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4",
        "[&_li]:mb-1",
        "[&_a]:underline hover:[&_a]:text-foreground-secondary",
        "[&_strong]:font-semibold",
        className,
      )}
      {...props}
    />
  );
}
