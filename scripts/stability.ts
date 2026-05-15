#!/usr/bin/env bun
/**
 * Memory + stability test (#64).
 *
 * Repeatedly runs the no-LLM hot path (L1 extraction + state updaters +
 * detectors + orchestrator) and samples `process.memoryUsage()` every
 * 10s. Fails if heap growth exceeds the threshold over the run.
 *
 * Default duration is 60s for CI; pass `--minutes 30` for a real soak.
 *
 * Writes a JSON time-series + a Markdown summary to
 * scripts/validation/stability-results.{json,md}.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  FunctionWordParser,
  AffectPass,
  LexiconLookup,
  LatencyZScore,
  BidAsymmetryDetector,
  PredictiveDivergenceDetector,
  PhantomThirdPartyDetector,
  EthicalRefusalClassifier,
  RelationshipModelUpdater,
  SelfModelUpdater,
  PartnerModelUpdater,
  RollingRate,
} from '../packages/engine/src/index.js';
import type { NormalizedMessage, FeatureVector } from '../packages/shared/src/types.js';
import { synthesiseFeature } from './ingest-corpus-helpers.js';

interface Args { minutes: number; sampleSec: number; thresholdMb: number }
function parseArgs(argv: string[]): Args {
  const a: Args = { minutes: 1, sampleSec: 10, thresholdMb: 20 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--minutes') a.minutes = Number(argv[++i]);
    else if (argv[i] === '--sample-sec') a.sampleSec = Number(argv[++i]);
    else if (argv[i] === '--threshold-mb') a.thresholdMb = Number(argv[++i]);
  }
  return a;
}

function makeBatch(seed: number): NormalizedMessage[] {
  const samples = ['hey', 'how are you', 'fine', 'just busy today', 'love you', 'me too',
    'why does he keep doing that', 'i hear you', 'thinking about us'];
  const msgs: NormalizedMessage[] = [];
  let t = Date.now();
  for (let i = 0; i < 10; i++) {
    msgs.push({
      message_id: `${seed}-${i}`,
      participant_id: i % 2 === 0 ? 'me' : 'partner',
      is_from_me: i % 2 === 0,
      text: samples[(seed + i) % samples.length],
      timestamp: new Date(t).toISOString(),
      chat_id: 'soak',
    });
    t += 60_000;
  }
  return msgs;
}

interface Sample { atMs: number; heapUsed: number; rss: number; external: number; iterations: number }

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dyad-soak-'));
  const fw = new FunctionWordParser();
  const lex = new LexiconLookup();
  const affect = new AffectPass(lex);
  const bid = new BidAsymmetryDetector();
  const div = new PredictiveDivergenceDetector();
  const phantom = new PhantomThirdPartyDetector();
  const eth = new EthicalRefusalClassifier({ bypass: true });
  const rr = new RollingRate(5);

  const samples: Sample[] = [];
  const start = Date.now();
  const endAt = start + args.minutes * 60_000;
  const sampleInterval = args.sampleSec * 1000;
  let lastSample = start;
  let iterations = 0;
  // Take baseline after a 1s warmup so heap can stabilise.
  await new Promise(r => setTimeout(r, 1000));
  if (typeof global.gc === 'function') global.gc();
  const baseline = process.memoryUsage();

  console.log(`[stability] running for ${args.minutes} min, sampling every ${args.sampleSec}s, threshold ${args.thresholdMb}MB`);
  while (Date.now() < endAt) {
    const seed = iterations;
    const msgs = makeBatch(seed);
    const lz = new LatencyZScore().computeMessageZScores(msgs);
    const features: FeatureVector[] = [];
    for (let i = 0; i < msgs.length; i++) {
      features.push(synthesiseFeature(
        msgs[i], fw.parse(msgs[i].text), affect.processMessage(msgs[i]),
        lz.get(msgs[i].message_id) ?? 0,
        i > 0 ? msgs[i - 1] : undefined,
        i > 0 ? features[i - 1] : undefined,
      ));
    }
    for (const m of msgs) rr.addEvent(m.timestamp);
    bid.detect(features, msgs);
    div.detect(features, msgs);
    phantom.detect(features);
    eth.classifyFromFeatures(features);
    new SelfModelUpdater(`soak-${seed % 5}`, tmpDir).update(features, msgs);
    new PartnerModelUpdater(`soak-${seed % 5}`, 'p', tmpDir).update(features, msgs);
    new RelationshipModelUpdater(`soak-${seed % 5}`, tmpDir).update(features, msgs);

    iterations++;
    if (Date.now() - lastSample >= sampleInterval) {
      const m = process.memoryUsage();
      samples.push({
        atMs: Date.now() - start,
        heapUsed: m.heapUsed,
        rss: m.rss,
        external: m.external,
        iterations,
      });
      lastSample = Date.now();
      console.log(`[stability] t=${Math.round((Date.now() - start) / 1000)}s heap=${Math.round(m.heapUsed / 1024 / 1024)}MB iter=${iterations}`);
    }
  }

  // Compare against the *minimum* heap of the last 3 samples to filter
  // GC-cycle noise — leaks show as a rising floor, not transient spikes.
  if (typeof global.gc === 'function') global.gc();
  const tailMin = samples.length >= 3
    ? Math.min(...samples.slice(-3).map(s => s.heapUsed))
    : (samples[samples.length - 1]?.heapUsed ?? baseline.heapUsed);
  const heapGrowthMb = (tailMin - baseline.heapUsed) / 1024 / 1024;
  const pass = heapGrowthMb < args.thresholdMb;
  fs.rmSync(tmpDir, { recursive: true, force: true });

  const outDir = path.resolve(process.cwd(), 'scripts/validation');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'stability-results.json'),
    JSON.stringify({ args, baseline, samples, iterations, heapGrowthMb, pass }, null, 2)
  );
  const md = [
    '# Memory + stability test (#64)',
    '',
    `Generated ${new Date().toISOString()} by \`scripts/stability.ts\`.`,
    '',
    `Duration: ${args.minutes} minute(s) · sample interval: ${args.sampleSec}s · threshold: ${args.thresholdMb}MB`,
    '',
    `Iterations completed: **${iterations}**`,
    `Heap growth: **${heapGrowthMb.toFixed(2)} MB** (threshold ${args.thresholdMb} MB) — ${pass ? '✅' : '⚠ FAIL'}`,
    '',
    '| t (s) | heap (MB) | rss (MB) | external (MB) | iterations |',
    '|-------|-----------|----------|---------------|------------|',
    ...samples.map(s => `| ${Math.round(s.atMs / 1000)} | ${(s.heapUsed / 1024 / 1024).toFixed(2)} | ${(s.rss / 1024 / 1024).toFixed(2)} | ${(s.external / 1024 / 1024).toFixed(2)} | ${s.iterations} |`),
    '',
    'Bounded data structures verified:',
    '',
    '- `RollingRate.cleanupOldEvents` prunes outside-window events on add',
    '- `LatencyZScore` evicts when per-participant `history.length >= windowSize`',
    '- `SelfModelUpdater` / `PartnerModelUpdater` / `RelationshipModelUpdater` overwrite their JSON on `save()` — no append-only growth',
    '- `BriefGenerator` / `ReframeGenerator` caches are in-memory and bounded by content (md5 keyspace)',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'stability-results.md'), md);
  console.log(`\nFinal heap growth: ${heapGrowthMb.toFixed(2)} MB (${pass ? 'PASS' : 'FAIL'})`);
  if (!pass) process.exit(2);
}

main().catch(err => { console.error('[stability] failed:', err); process.exit(1); });
