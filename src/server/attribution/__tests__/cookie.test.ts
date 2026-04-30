import { describe, expect, it } from 'vitest';
import { extractAttributionFromUrl, parseAttributionCookie, ATTRIBUTION_COOKIE_NAME } from '../cookie';

describe('attribution cookie', () => {
  it('extracts UTM params from URL', () => {
    const url = new URL('http://x.com/coats?utm_source=instagram&utm_medium=story&utm_campaign=fall26');
    const att = extractAttributionFromUrl(url, '/coats', 'https://insta.com');
    expect(att).toMatchObject({
      utmSource: 'instagram', utmMedium: 'story', utmCampaign: 'fall26',
      referrer: 'https://insta.com', landingPath: '/coats',
    });
  });

  it('returns null when no UTM keys present', () => {
    const url = new URL('http://x.com/coats?other=1');
    expect(extractAttributionFromUrl(url, '/coats', null)).toBeNull();
  });

  it('parses a cookie value back into AttributionPayload', () => {
    const original = {
      utmSource: 'google', utmMedium: 'cpc', utmCampaign: null, utmTerm: null, utmContent: null,
      referrer: null, landingPath: '/', capturedAt: new Date().toISOString(),
    };
    const cookie = JSON.stringify(original);
    expect(parseAttributionCookie(cookie)).toMatchObject({ utmSource: 'google' });
  });

  it('safely returns null on garbage cookie', () => {
    expect(parseAttributionCookie('{bad')).toBeNull();
    expect(parseAttributionCookie('')).toBeNull();
  });

  it('exports stable cookie name', () => {
    expect(ATTRIBUTION_COOKIE_NAME).toBe('__ynot_attribution');
  });
});
