"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface PhoneInputProps {
  label?: string;
  prefix?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  id?: string;
  className?: string;
}

export function PhoneInput({
  label,
  prefix = "+44",
  value,
  onChange,
  placeholder,
  error,
  id,
  className,
}: PhoneInputProps) {
  const reactId = React.useId();
  const inputId = id ?? reactId;
  // Strip prefix from incoming value to display only the local part
  const local = value.startsWith(prefix)
    ? value.slice(prefix.length).trimStart()
    : value;

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label
          htmlFor={inputId}
          className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-secondary"
        >
          {label}
        </label>
      )}
      <div
        className={cn(
          "flex items-center border-b border-border-light",
          "focus-within:border-foreground-primary",
          error && "border-error focus-within:border-error",
        )}
      >
        <span className="pr-3 text-[14px] text-foreground-secondary">
          {prefix}
        </span>
        <input
          id={inputId}
          type="tel"
          inputMode="tel"
          value={local}
          onChange={(e) =>
            onChange(`${prefix} ${e.target.value.replace(/^\s+/, "")}`)
          }
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          className={cn(
            "h-[48px] flex-1 bg-transparent py-3",
            "text-[14px] text-foreground-primary placeholder:text-foreground-tertiary",
            "focus:outline-none rounded-none",
            className,
          )}
        />
      </div>
      {error && <p className="text-[12px] text-error">{error}</p>}
    </div>
  );
}
