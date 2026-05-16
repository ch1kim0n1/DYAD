#!/usr/bin/env bun
/**
 * Sync calendar from ICS URL into local GBrain.
 * Uses CARECIRCLE_CALENDAR_ICS_URL from .env or first CLI argument.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CareCircleGBrainStore } from '../apps/mac/src/lib/carecircle-gbrain-store.js';
import {
  getCalendarIcsUrlFromEnv,
  normalizeIcsUrl,
  syncCalendarIcsToGBrain,
} from '../apps/mac/src/lib/sync-calendar-gbrain.js';
import { ensureCareCircleGBrainSeeded } from '../apps/mac/src/lib/seed-carecircle-gbrain.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const home = process.env.GBRAIN_HOME ?? resolve(repoRoot, '.gbrain-carecircle');
const icsUrl = normalizeIcsUrl(process.argv[2] ?? getCalendarIcsUrlFromEnv() ?? '');

const store = new CareCircleGBrainStore(home);
await ensureCareCircleGBrainSeeded(store);
const result = await syncCalendarIcsToGBrain(store, icsUrl);

console.log(`[carecircle-calendar] synced ${result.synced} events → ${home}`);
console.log(`[carecircle-calendar] upcoming: ${result.upcoming.length}, past: ${result.past.length}`);
