import 'dotenv/config';
import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM;
const to = process.argv[2];

if (!apiKey || !from) {
  console.error('Missing RESEND_API_KEY or RESEND_FROM in env');
  process.exit(1);
}
if (!to) {
  console.error('Usage: node scripts/send-test-email.mjs <recipient-email>');
  process.exit(1);
}

const resend = new Resend(apiKey);

const html = `
<div style="font-family: Inter, -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; color: #111;">
  <h1 style="font-family: 'Playfair Display', Georgia, serif; font-size: 32px; margin: 0 0 8px 0; letter-spacing: -0.02em;">YNOT London</h1>
  <p style="font-size: 13px; color: #666; margin: 0 0 24px 0; letter-spacing: 0.1em; text-transform: uppercase;">Delivery test</p>
  <p>Hi,</p>
  <p>This is a delivery test from the YNOT London transactional email system.</p>
  <p>If you can read this, the Resend → ynotlondon.com pipeline is wired correctly:</p>
  <ul>
    <li>Domain verified</li>
    <li>DKIM signed</li>
    <li>SPF aligned with M365</li>
    <li>Sending through hello@ynotlondon.com</li>
  </ul>
  <p>Test sent on 2026-04-30.</p>
  <hr style="border: 0; border-top: 1px solid #eee; margin: 32px 0;" />
  <p style="font-size: 12px; color: #777; line-height: 1.5;">
    YNOT London<br />
    13 Elvaston Place &middot; London SW7 5QG
  </p>
</div>
`;

const result = await resend.emails.send({
  from,
  to,
  subject: 'YNOT London — delivery test',
  html,
  text: 'YNOT London delivery test. If you can read this, Resend → ynotlondon.com is working. Sent 2026-04-30.',
});

console.log(JSON.stringify(result, null, 2));
