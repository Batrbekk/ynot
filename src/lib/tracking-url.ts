import type { Carrier } from "@prisma/client";

/**
 * Build a customer-facing carrier tracking URL.
 *
 * Royal Mail accepts the tracking number directly in the path
 * (`/track/<num>`); DHL Express uses the global tracking page query string
 * (`?submit=1&tracking-id=<num>`). Both formats are stable enough to hard-code
 * here — see Phase 5 spec §13.1.
 *
 * Returns null when the tracking number is missing or empty.
 */
export function getTrackingUrl(
  carrier: Carrier,
  trackingNumber: string | null | undefined,
): string | null {
  if (!trackingNumber) return null;
  if (carrier === "ROYAL_MAIL") {
    return `https://www.royalmail.com/track/${trackingNumber}`;
  }
  return `https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id=${trackingNumber}`;
}
