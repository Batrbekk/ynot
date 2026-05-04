import type { EmailService } from '@/server/email';
import { getEmailService } from '@/server/email';
import { processDueEmailJobs } from '@/server/email/jobs';
// Side-effect import: registers all 14 React Email templates so the job
// processor can resolve `EmailJob.template` lookups.
import '@/emails/_register';

/**
 * Thin worker wrapper: drains due `EmailJob` rows and dispatches them via the
 * supplied transport. Default uses the production singleton from
 * {@link getEmailService}; tests may inject a mock service.
 */
export async function processEmailJobs(svc: EmailService = getEmailService()) {
  return processDueEmailJobs(svc);
}
