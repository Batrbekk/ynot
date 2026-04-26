"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

interface ToastEntry {
  id: number;
  text: string;
}

interface ToastContextValue {
  show: (text: string, durationMs?: number) => void;
}

const Ctx = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useToast must be inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastEntry[]>([]);

  const show = React.useCallback((text: string, durationMs = 3000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, durationMs);
  }, []);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "bg-foreground-primary text-foreground-inverse px-4 py-3",
              "text-[13px] tracking-wide",
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
