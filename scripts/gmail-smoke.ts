#!/usr/bin/env bun
/**
 * Manual Gmail OAuth + list smoke test.
 *
 *   1. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI in .env
 *   2. bun run scripts/gmail-smoke.ts
 *   3. Open the printed URL, authorize, complete redirect to sidecar or this script
 */
import { getAuthUrl, getGmailStatus, isGmailConnected, listGmailMessages } from '@dyad/ingestion';

async function main() {
  const status = await getGmailStatus();
  console.log('[gmail-smoke] status:', status);

  if (!status.configured) {
    console.error('Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env');
    process.exit(1);
  }

  if (!isGmailConnected()) {
    console.log('\nOpen this URL in a browser (sidecar must be running for callback):\n');
    console.log(getAuthUrl());
    console.log('\nAfter authorizing, re-run this script.');
    process.exit(0);
  }

  const { emails } = await listGmailMessages({ maxResults: 5 });
  console.log(`[gmail-smoke] fetched ${emails.length} messages`);
  for (const e of emails.slice(0, 3)) {
    console.log(`  - ${e.subject.slice(0, 60)} (${new Date(e.internal_date).toISOString()})`);
  }
}

main().catch((err) => {
  console.error('[gmail-smoke] failed:', err);
  process.exit(1);
});
