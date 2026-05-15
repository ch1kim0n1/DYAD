#!/usr/bin/env bun
/**
 * Pre-warm demo cache — run the full pipeline on a fixture (or live chat.db
 * data when `--live` is set) before a demo so the app's first-paint is fast.
 *
 * Usage:
 *   bun run scripts/prewarm-demo.ts \
 *     --fixture scripts/fixtures/healthy-couple.json
 *
 *   bun run scripts/prewarm-demo.ts --live --conversation-id <id> --days 7
 *
 * What it does:
 *   1. Load messages (fixture or via the running sidecar's /load-messages)
 *   2. POST /analyze on the sidecar (warms LLM + state caches + GBrain pages)
 *   3. POST /brief for every detected pattern (warms BriefGenerator cache)
 *   4. Print summary so the operator can confirm before the demo
 *
 * Idempotent: running twice produces the same cache state, no errors.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  NormalizedMessage,
  OrchestratorResult,
} from '../packages/shared/src/types.js';
import type { DetectorType } from '../packages/engine/src/intervention/brief-prompt.js';

const SIDECAR_URL = process.env.DYAD_SIDECAR_URL ?? 'http://localhost:7432';

interface Args {
  fixture?: string;
  live: boolean;
  conversationId?: string;
  days: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { live: false, days: 7 };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--fixture') args.fixture = argv[++i];
    else if (v === '--live') args.live = true;
    else if (v === '--conversation-id') args.conversationId = argv[++i];
    else if (v === '--days') args.days = Number(argv[++i]);
  }
  return args;
}

async function waitForSidecar(timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${SIDECAR_URL}/status`);
      if (res.ok) return true;
    } catch { /* keep polling */ }
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

async function getMessages(args: Args): Promise<NormalizedMessage[]> {
  if (args.fixture) {
    const filePath = path.resolve(process.cwd(), args.fixture);
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as NormalizedMessage[];
  }
  // --live: ask the sidecar to read chat.db
  const since = args.days > 0 ? Date.now() - args.days * 24 * 60 * 60 * 1000 : undefined;
  const res = await fetch(`${SIDECAR_URL}/load-messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chatId: args.conversationId, since }),
  });
  if (!res.ok) throw new Error(`/load-messages failed: ${res.status}`);
  const data = await res.json() as { messages: NormalizedMessage[]; error?: string };
  if (data.error) console.warn(`[prewarm] /load-messages warning: ${data.error}`);
  return data.messages;
}

function detectedPatterns(result: OrchestratorResult): DetectorType[] {
  const out: DetectorType[] = [];
  if (result.bid_asymmetry?.detected) out.push('bid_asymmetry');
  if (result.predictive_divergence?.detected) out.push('predictive_divergence');
  if (result.phantom_third_party?.detected) out.push('phantom_third_party');
  if (result.primary_secondary && result.primary_secondary.confidence >= 0.7) {
    out.push('primary_secondary');
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const start = Date.now();
  console.log('[prewarm] pinging sidecar at', SIDECAR_URL);
  const up = await waitForSidecar(15_000);
  if (!up) {
    console.error('[prewarm] sidecar not responding — start `bun run sidecar:dev` first');
    process.exit(1);
  }

  console.log('[prewarm] loading messages…');
  const messages = await getMessages(args);
  console.log(`[prewarm] ${messages.length} messages loaded`);
  if (messages.length === 0) {
    console.warn('[prewarm] no messages — nothing to warm');
    return;
  }

  console.log('[prewarm] running /analyze (this warms extraction + GBrain)…');
  const analyzeRes = await fetch(`${SIDECAR_URL}/analyze`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (!analyzeRes.ok) {
    console.error(`[prewarm] /analyze failed: ${analyzeRes.status}`);
    process.exit(2);
  }
  const result = await analyzeRes.json() as OrchestratorResult;

  console.log('[prewarm] running /brief for each detected pattern…');
  const briefs: Record<string, string | null> = {};
  for (const det of detectedPatterns(result)) {
    const r = await fetch(`${SIDECAR_URL}/brief`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ detectorType: det, result, messages: messages.slice(-8) }),
    });
    if (r.ok) {
      const body = await r.json() as { brief: string | null };
      briefs[det] = body.brief;
    } else {
      briefs[det] = null;
    }
  }

  const elapsed = Date.now() - start;
  console.log('---');
  console.log(`[prewarm] complete in ${elapsed}ms`);
  console.log(`  messages: ${messages.length}`);
  console.log(`  detector_results: ${detectedPatterns(result).length}`);
  console.log(`  briefs_ready: ${Object.values(briefs).filter(Boolean).length}`);
  console.log(`  gottman_status: ${result.relationship_model?.gottman_status ?? 'n/a'}`);
}

main().catch(err => {
  console.error('[prewarm] failed:', err);
  process.exit(1);
});
