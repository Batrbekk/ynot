"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

const DEFAULT_MESSAGES = [
  "Sign in and get 10% off your first order",
  "Free UK shipping",
];

const ROTATE_INTERVAL_MS = 4000;

export interface AnnouncementBarProps {
  messages?: string[];
  className?: string;
}

export function AnnouncementBar({
  messages = DEFAULT_MESSAGES,
  className,
}: AnnouncementBarProps) {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (messages.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, ROTATE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [messages.length]);

  return (
    <div
      className={cn(
        "h-9 md:h-9 flex items-center justify-center overflow-hidden",
        "bg-surface-announcement text-foreground-inverse",
        className,
      )}
      aria-live="polite"
    >
      <div className="relative h-full w-full flex items-center justify-center">
        {messages.map((msg, i) => (
          <span
            key={i}
            className={cn(
              "absolute inset-0 flex items-center justify-center",
              "text-[11px] md:text-[12px] font-body uppercase tracking-[0.2em]",
              "transition-opacity duration-700 ease-in-out",
              i === index ? "opacity-100" : "opacity-0",
            )}
          >
            {msg}
          </span>
        ))}
      </div>
    </div>
  );
}
