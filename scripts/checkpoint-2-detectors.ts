#!/usr/bin/env bun
/**
 * Integration checkpoint 2 (#52) — detectors fire correctly and briefs generate.
 *
 * Pass criteria:
 *   - DetectorOrchestrator.run completes without error on real features
 *   - Ethical refusal runs first and is `safe: true` on the test fixture
 *   - At least one analytical detector fires (or explicitly noted if none)
 *   - BriefGenerator produces a brief per fired detector in < 5s (skipped no key)
 *   - ReframeGenerator produces a reframe in < 10s (skipped no key)
 *   - Full pipeline < 30s end-to-end
 *
 * Usage:
 *   bun run scripts/checkpoint-2-detectors.ts --fixture scripts/fixtures/bid-asymmetry.json
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  FunctionWordParser,
  AffectPass,
  LexiconLookup,
  LatencyZScore,
  RelationshipModelUpdater,
  SelfModelUpdater,
  PartnerModelUpdater,
  DetectorOrchestrator,
  EthicalRefusalClassifier,
  BriefGenerator,
  ReframeGenerator,
  type DetectorType,
} from '../packages/engine/src/index.js';
import type { FeatureVector, NormalizedMessage } from '../packages/shared/src/types.js';
import { synthesiseFeature } from './ingest-corpus-helpers.js';

interface CheckResult { name: string; ok: boolean; detail: string }

function parseArgs(argv: string[]): { fixture: string } {
  const idx = argv.indexOf('--fixture');
  if (idx === -1 || !argv[idx + 1]) {
    console.error('Usage: checkpoint-2-detectors --fixture <path>');
    process.exit(1);
  }
  return { fixture: argv[idx + 1] };
}

function detectedPatterns(orchestratorResult: Awaited<ReturnType<DetectorOrchestrator['run']>>): DetectorType[] {
  const out: DetectorType[] = [];
  if (orchestratorResult.bid_asymmetry?.detected) out.push('bid_asymmetry');
  if (orchestratorResult.predictive_divergence?.detected) out.push('predictive_divergence');
  if (orchestratorResult.phantom_third_party?.detected) out.push('phantom_third_party');
  if (orchestratorResult.primary_secondary && orchestratorResult.primary_secondary.confidence >= 0.7) {
    out.push('primary_secondary');
  }
  return out;
}

async function main() {
  const { fixture } = parseArgs(process.argv.slice(2));
  const t0 = Date.now();
  const results: CheckResult[] = [];

  const messages = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), fixture), 'utf8')) as NormalizedMessage[];
  results.push({ name: 'fixture loaded', ok: messages.length > 0, detail: `${messages.length} messages` });

  // Build features
  const fwParser = new FunctionWordParser();
  const lex = new LexiconLookup();
  const affect = new AffectPass(lex);
  const latency = new LatencyZScore();
  const latencyMap = latency.computeMessageZScores(messages);
  const features: FeatureVector[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    features.push(synthesiseFeature(
      m, fwParser.parse(m.text), affect.processMessage(m),
      latencyMap.get(m.message_id) ?? 0,
      i > 0 ? messages[i - 1] : undefined,
      i > 0 ? features[i - 1] : undefined,
    ));
  }

  // Update relationship model so the orchestrator has it
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dyad-chk2-'));
  new SelfModelUpdater('chk2-user', tmpDir).update(features, messages);
  new PartnerModelUpdater('chk2-dyad', 'chk2-partner', tmpDir).update(features, messages);
  const rel = new RelationshipModelUpdater('chk2-dyad', tmpDir).update(features, messages);

  // Orchestrator
  const ethical = new EthicalRefusalClassifier({ bypass: true });
  const orchestrator = new DetectorOrchestrator({ ethical, dyadId: 'chk2-dyad' });

  let orchestratorResult: Awaited<ReturnType<DetectorOrchestrator['run']>>;
  try {
    orchestratorResult = await orchestrator.run({ messages, features, relationshipModel: rel });
    results.push({ name: 'orchestrator.run() succeeded', ok: true, detail: 'no exceptions' });
  } catch (err) {
    results.push({ name: 'orchestrator.run() succeeded', ok: false, detail: (err as Error).message });
    fs.rmSync(tmpDir, { recursive: true, force: true });
    finalise(results, Date.now() - t0);
    process.exit(2);
  }

  results.push({
    name: 'ethical refusal returns safe',
    ok: orchestratorResult.ethical_refusal.safe === true,
    detail: `safe=${orchestratorResult.ethical_refusal.safe}`,
  });

  const fired = detectedPatterns(orchestratorResult);
  results.push({
    name: 'at least one analytical detector fired',
    ok: fired.length > 0,
    detail: fired.length > 0 ? fired.join(', ') : 'none — explicitly noted',
  });

  // Brief + reframe — only meaningful with a real key
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
  if (hasKey && fired.length > 0) {
    const briefGen = new BriefGenerator();
    const reframeGen = new ReframeGenerator();
    for (const det of fired) {
      const briefStart = Date.now();
      const brief = await briefGen.generate(det, orchestratorResult, messages.slice(-8));
      const briefMs = Date.now() - briefStart;
      results.push({
        name: `brief for ${det} < 5s`,
        ok: brief !== null && briefMs < 5000,
        detail: `${briefMs}ms; ${brief ? 'ok' : 'null'}`,
      });
      if (brief) {
        const rfStart = Date.now();
        const rf = await reframeGen.generate(det, orchestratorResult, brief, messages.slice(-6));
        const rfMs = Date.now() - rfStart;
        results.push({
          name: `reframe for ${det} < 10s`,
          ok: rf !== null && rfMs < 10000,
          detail: `${rfMs}ms; ${rf ? 'ok' : 'null'}`,
        });
      }
    }
  } else {
    results.push({ name: 'brief / reframe latency', ok: true, detail: 'SKIPPED (no ANTHROPIC_API_KEY or no detectors)' });
  }

  const total = Date.now() - t0;
  results.push({ name: 'end-to-end < 30s', ok: total < 30_000, detail: `${total}ms` });

  fs.rmSync(tmpDir, { recursive: true, force: true });
  finalise(results, total);
  if (results.some(r => !r.ok)) process.exit(2);
}

function finalise(results: CheckResult[], elapsedMs: number): void {
  console.log('\n=== Checkpoint 2: Detectors + Generation ===');
  for (const r of results) {
    const icon = r.ok ? '✓' : '✗';
    console.log(`  ${icon} ${r.name.padEnd(40)} ${r.detail}`);
  }
  console.log(`\nElapsed: ${elapsedMs}ms`);
}

main().catch(err => { console.error('[chk2] failed:', err); process.exit(1); });
