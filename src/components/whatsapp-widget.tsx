import * as React from "react";
import { WhatsAppIcon } from "./icons";
import { cn } from "@/lib/cn";

export interface WhatsAppWidgetProps {
  phone: string;
  message?: string;
  className?: string;
}

export function WhatsAppWidget({
  phone,
  message,
  className,
}: WhatsAppWidgetProps) {
  const href = `https://wa.me/${phone.replace(/[^0-9]/g, "")}${
    message ? `?text=${encodeURIComponent(message)}` : ""
  }`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className={cn(
        "fixed bottom-6 right-6 z-40",
        "h-14 w-14 rounded-full bg-[#25D366] text-white",
        "flex items-center justify-center shadow-lg",
        "hover:scale-105 transition-transform",
        className,
      )}
    >
      <WhatsAppIcon />
    </a>
  );
}
