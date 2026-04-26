"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { duration, ease } from "@/lib/motion";
import { useCookieConsentStore } from "@/lib/stores/cookie-consent-store";

/**
 * useSyncExternalStore-based hook returns the persisted status on the client
 * after hydration, and "accepted" during SSR — meaning the banner does NOT
 * render server-side. This avoids both the SSR/CSR mismatch (we never render
 * differently than the server snapshot says) AND the react-hooks/set-state-in-effect
 * lint rule, since we don't call setState in any effect.
 */
function useConsentStatus(): "pending" | "accepted" | "declined" {
  return React.useSyncExternalStore(
    (cb) => useCookieConsentStore.subscribe(cb),
    () => useCookieConsentStore.getState().status,
    () => "accepted",
  );
}

export function CookieBanner() {
  const status = useConsentStatus();
  const accept = useCookieConsentStore((s) => s.accept);
  const decline = useCookieConsentStore((s) => s.decline);

  return (
    <AnimatePresence>
      {status === "pending" && (
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{
            y: 0,
            opacity: 1,
            transition: { duration: duration.slow, ease: ease.drawer, delay: 0.6 },
          }}
          exit={{
            y: "100%",
            opacity: 0,
            transition: { duration: duration.base, ease: ease.out },
          }}
          className="fixed bottom-0 left-0 right-0 z-30 border-t border-border-light bg-surface-primary shadow-[0_-2px_8px_rgba(0,0,0,0.04)]"
        >
          <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-10">
            <p className="text-[13px] leading-relaxed text-foreground-primary md:max-w-[640px]">
              We use cookies to give you the best shopping experience and analyse
              site traffic. See our{" "}
              <Link href="/privacy" className="underline hover:no-underline">
                privacy policy
              </Link>{" "}
              for details.
            </p>
            <div className="flex flex-shrink-0 gap-3">
              <Button variant="outline" size="md" onClick={decline}>
                Decline
              </Button>
              <Button size="md" onClick={accept}>
                Accept
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
