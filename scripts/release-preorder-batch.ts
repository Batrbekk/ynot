#!/usr/bin/env tsx
/**
 * CLI: release a PreorderBatch for shipping.
 *
 * Usage:
 *   pnpm tsx scripts/release-preorder-batch.ts <batchId>
 *
 * Marks the batch SHIPPING and runs `tryCreateShipment` for every Shipment
 * holding at least one item assigned to the batch. Prints a JSON summary on
 * stdout and exits 0 when every shipment label was created (or already
 * existed); exits 1 if any shipment failed (carrier 5xx, missing creds, etc.)
 * so cron / Make.com runners can alert.
 *
 * Phase 5 ships only this CLI; Phase 6 adds an admin UI button on top of the
 * same `releaseBatchForShipping` function.
 */
import { releaseBatchForShipping } from '../src/server/preorders/service';
import { tryCreateShipment } from '../src/server/fulfilment/service';
import { sendLabelFailureAlert } from '../src/server/alerts/service';
import { getLabelStorage } from '../src/server/fulfilment/storage-factory';
import { DhlExpressProvider } from '../src/server/shipping/dhl-express';
import { RoyalMailClickDropProvider } from '../src/server/shipping/royal-mail-click-drop';
import { env } from '../src/server/env';

async function main(): Promise<void> {
  const batchId = process.argv[2];
  if (!batchId) {
    console.error(
      'Usage: pnpm tsx scripts/release-preorder-batch.ts <batchId>',
    );
    process.exit(1);
  }

  if (!env.ROYAL_MAIL_API_KEY) {
    console.error('ROYAL_MAIL_API_KEY is required.');
    process.exit(1);
  }
  if (!env.DHL_API_KEY || !env.DHL_API_SECRET || !env.DHL_ACCOUNT_NUMBER) {
    console.error('DHL_API_KEY, DHL_API_SECRET, DHL_ACCOUNT_NUMBER are required.');
    process.exit(1);
  }

  const dhl = new DhlExpressProvider({
    apiKey: env.DHL_API_KEY,
    apiSecret: env.DHL_API_SECRET,
    accountNumber: env.DHL_ACCOUNT_NUMBER,
  });
  const rm = new RoyalMailClickDropProvider({ apiKey: env.ROYAL_MAIL_API_KEY });
  const storage = getLabelStorage(env);

  const result = await releaseBatchForShipping(batchId, {
    tryCreateShipment,
    shipmentDeps: { dhl, rm, storage, sendLabelFailureAlert },
  });

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');

  const anyFailed = result.results.some((r) => !r.result.ok);
  process.exit(anyFailed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
