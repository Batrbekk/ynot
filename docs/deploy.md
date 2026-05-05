# YNOT Production Deploy Runbook

## Sentry setup

1. Create Sentry account: https://sentry.io/signup/ (free tier, 5k events/month)
2. Create project → "Next.js" platform → name `ynot-london`
3. Copy DSN from Project Settings → Client Keys (DSN); paste into `/etc/ynot/secrets.env`:
   - `SENTRY_DSN=...`
   - `NEXT_PUBLIC_SENTRY_DSN=...`
4. Create auth token: Settings → Account → Auth Tokens → New (scope `project:write`)
5. Add to GitHub repo Secrets as `SENTRY_AUTH_TOKEN` (used by deploy workflow for source maps)

## UptimeRobot setup

1. Create UptimeRobot account: https://uptimerobot.com/signUp (free tier, 50 monitors)
2. Create monitor: HTTP(S), URL `https://ynotlondon.com`, interval 5 min
3. Create monitor: HTTP(S), URL `https://ynotlondon.com/api/health`, interval 5 min, alert when status code != 200
4. Add alert contact: email `alerts@ynotlondon.com`

(Full runbook expanded in later tasks — bootstrap, deploy, rollback, restore.)
