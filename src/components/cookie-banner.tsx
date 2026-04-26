"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useCookieConsentStore } from "@/lib/stores/cookie-consent-store";

export function CookieBanner() {
  const status = useCookieConsentStore((s) => s.status);
  const accept = useCookieConsentStore((s) => s.accept);
  const decline = useCookieConsentStore((s) => s.decline);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid SSR/CSR mismatch — render only after mount once persist hydrates
  if (!mounted) return null;
  if (status !== "pending") return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border-light bg-surface-primary shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
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
    </div>
  );
}
