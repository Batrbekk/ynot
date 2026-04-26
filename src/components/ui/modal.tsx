"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/cn";
import { modalPanel, overlayBackdrop } from "@/lib/motion";
import { CloseIcon } from "../icons";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  width = "min(440px, 90vw)",
}: ModalProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          <motion.button
            type="button"
            aria-label="Close modal"
            onClick={onClose}
            className="absolute inset-0 bg-black/40"
            variants={overlayBackdrop}
            initial="hidden"
            animate="visible"
            exit="exit"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              "relative bg-surface-primary text-foreground-primary p-6",
              "border border-border-light",
            )}
            style={{ width }}
            variants={modalPanel}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 h-9 w-9 flex items-center justify-center hover:bg-surface-secondary"
            >
              <CloseIcon />
            </button>
            <h2 className="text-[16px] font-semibold uppercase tracking-[0.15em] mb-4 pr-10">
              {title}
            </h2>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
