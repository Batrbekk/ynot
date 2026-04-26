"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/cn";
import { drawerPanelLeft, drawerPanelRight, overlayBackdrop } from "@/lib/motion";
import { CloseIcon } from "../icons";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side: "left" | "right";
  title: string;
  /** Hides the visible title heading but keeps it for screen readers. */
  hideTitle?: boolean;
  width?: string;
  children: React.ReactNode;
}

export function Drawer({
  open,
  onClose,
  side,
  title,
  hideTitle,
  width = "min(420px, 100vw)",
  children,
}: DrawerProps) {
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

  const panelVariants = side === "left" ? drawerPanelLeft : drawerPanelRight;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.button
            type="button"
            data-testid="drawer-backdrop"
            aria-label="Close drawer"
            onClick={onClose}
            className="absolute inset-0 bg-black/40"
            variants={overlayBackdrop}
            initial="hidden"
            animate="visible"
            exit="exit"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              "absolute top-0 bottom-0 bg-surface-primary text-foreground-primary",
              "flex flex-col",
              side === "left" ? "left-0" : "right-0",
            )}
            style={{ width }}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <header className="flex items-center justify-between p-5 border-b border-border-light">
              <h2
                className={cn(
                  "text-[12px] font-semibold uppercase tracking-[0.2em] text-foreground-primary",
                  hideTitle && "sr-only",
                )}
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="h-10 w-10 -mr-2 flex items-center justify-center hover:bg-surface-secondary"
              >
                <CloseIcon />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
