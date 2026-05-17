#!/usr/bin/env bun
/**
 * Load the 24-document CareCircle demo corpus into local GBrain storage.
 *
 *   bun run carecircle:seed-gbrain
 *
 * Data is written to .gbrain-carecircle/pages/ at the repo root.
 * The Mac app reads only from this store for dashboard + context search.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CareCircleGBrainStore } from '../apps/mac/src/lib/carecircle-gbrain-store.js';
import { seedCareCircleGBrain } from '../apps/mac/src/lib/seed-carecircle-gbrain.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const home = process.env.GBRAIN_HOME ?? resolve(repoRoot, '.gbrain-carecircle');

const store = new CareCircleGBrainStore(home);
const { seeded } = seedCareCircleGBrain(store);

console.log(`[carecircle-gbrain] seeded ${seeded} source pages → ${home}`);
