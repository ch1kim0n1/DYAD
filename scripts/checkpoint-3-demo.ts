#!/usr/bin/env bun
/**
 * Integration checkpoint 3 (#55) — full app demo smoke harness.
 *
 * This script can't drive a real Tauri window, so it does the closest
 * verifiable thing: spawns the sidecar (already running), walks the demo
 * flow through HTTP, and reports pass/fail for each step. Use this on
 * the demo machine just before the demo so any wiring break surfaces
 * immediately.
 *
 * Usage:
 *   bun run scripts/checkpoint-3-demo.ts --fixture scripts/fixtures/bid-asymmetry.json
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { NormalizedMessage, OrchestratorResult } from '../packages/shared/src/types.js';

const SIDECAR_URL = process.env.DYAD_SIDECAR_URL ?? 'http://localhost:7432';

interface Step { name: string; ok: boolean; detail: string }

async function waitFor(timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${SIDECAR_URL}/status`);
      if (r.ok) return true;
    } catch { /* retry */ }
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  const fixIdx = process.argv.indexOf('--fixture');
  if (fixIdx === -1) {
    console.error('Usage: checkpoint-3-demo --fixture <path>');
    process.exit(1);
  }
  const messages = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), process.argv[fixIdx + 1]), 'utf8')) as NormalizedMessage[];
  const steps: Step[] = [];

  // 1. Sidecar up
  const up = await waitFor(15_000);
  steps.push({ name: 'sidecar /status responsive', ok: up, detail: up ? 'ok' : 'unreachable' });
  if (!up) { finalise(steps); process.exit(2); }

  // 2. /load-messages (will return empty on Windows/no chat.db)
  const lm = await fetch(`${SIDECAR_URL}/load-messages`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  steps.push({ name: '/load-messages returns 200', ok: lm.ok, detail: `HTTP ${lm.status}` });

  // 3. /analyze
  const t0 = Date.now();
  const an = await fetch(`${SIDECAR_URL}/analyze`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  const analyzeMs = Date.now() - t0;
  steps.push({ name: '/analyze returns 200', ok: an.ok, detail: `HTTP ${an.status} (${analyzeMs}ms)` });
  if (!an.ok) { finalise(steps); process.exit(2); }
  const result = await an.json() as OrchestratorResult;

  steps.push({
    name: 'ethical refusal safe (analytical UI allowed)',
    ok: result.ethical_refusal.safe === true,
    detail: `safe=${result.ethical_refusal.safe}`,
  });
  steps.push({
    name: 'relationship_model populated',
    ok: result.relationship_model !== undefined,
    detail: result.relationship_model?.gottman_status ?? 'missing',
  });
  steps.push({
    name: 'detector slots populated',
    ok: result.bid_asymmetry !== undefined && result.predictive_divergence !== undefined && result.phantom_third_party !== undefined,
    detail: 'bid/divergence/phantom all present',
  });

  // 4. /brief — only when sidecar reports brief_ready
  const status = await (await fetch(`${SIDECAR_URL}/status`)).json() as { brief_ready: boolean };
  if (status.brief_ready) {
    const briefStart = Date.now();
    const br = await fetch(`${SIDECAR_URL}/brief`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ detectorType: 'bid_asymmetry', result, messages: messages.slice(-8) }),
    });
    steps.push({
      name: '/brief returns within 10s',
      ok: br.ok && Date.now() - briefStart < 10_000,
      detail: `HTTP ${br.status} (${Date.now() - briefStart}ms)`,
    });
  } else {
    steps.push({ name: '/brief generation', ok: true, detail: 'SKIPPED (sidecar not configured with API key)' });
  }

  finalise(steps);
  if (steps.some(s => !s.ok)) process.exit(2);
}

function finalise(steps: Step[]): void {
  console.log('\n=== Checkpoint 3: Demo Smoke ===');
  for (const s of steps) {
    const icon = s.ok ? '✓' : '✗';
    console.log(`  ${icon} ${s.name.padEnd(48)} ${s.detail}`);
  }
}

main().catch(err => { console.error('[chk3] failed:', err); process.exit(1); });
