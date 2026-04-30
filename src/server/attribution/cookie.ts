export const ATTRIBUTION_COOKIE_NAME = '__ynot_attribution';
const KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

export interface AttributionPayload {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  referrer: string | null;
  landingPath: string;
  capturedAt: string; // ISO
}

export function extractAttributionFromUrl(
  url: URL,
  landingPath: string,
  referrer: string | null,
): AttributionPayload | null {
  const has = KEYS.some((k) => url.searchParams.has(k));
  if (!has) return null;
  return {
    utmSource: url.searchParams.get('utm_source'),
    utmMedium: url.searchParams.get('utm_medium'),
    utmCampaign: url.searchParams.get('utm_campaign'),
    utmTerm: url.searchParams.get('utm_term'),
    utmContent: url.searchParams.get('utm_content'),
    referrer,
    landingPath,
    capturedAt: new Date().toISOString(),
  };
}

export function parseAttributionCookie(value: string | null | undefined): AttributionPayload | null {
  if (!value) return null;
  try {
    const obj = JSON.parse(value);
    if (typeof obj !== 'object' || obj === null) return null;
    return {
      utmSource: obj.utmSource ?? null,
      utmMedium: obj.utmMedium ?? null,
      utmCampaign: obj.utmCampaign ?? null,
      utmTerm: obj.utmTerm ?? null,
      utmContent: obj.utmContent ?? null,
      referrer: obj.referrer ?? null,
      landingPath: obj.landingPath ?? '/',
      capturedAt: obj.capturedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
