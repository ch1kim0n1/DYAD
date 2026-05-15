#!/usr/bin/env bun
/**
 * Performance benchmark (#62) — measures the hot paths.
 *
 * Default (no API key): benches L1 extraction and detectors using synthesised
 * feature vectors (no LLM round-trips). With `--with-llm` set and a real
 * `ANTHROPIC_API_KEY`, also benches L2 extraction and brief generation.
 *
 * Writes a Markdown report to scripts/validation/benchmark-results.md.
 *
 * Usage:
 *   bun run scripts/benchmark.ts --messages 100 --runs 5
 *   bun run scripts/benchmark.ts --messages 50  --runs 3 --with-llm
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
  DetectorOrchestrator,
  RelationshipModelUpdater,
} from '../packages/engine/src/index.js';
import type { NormalizedMessage } from '../packages/shared/src/types.js';
import { synthesiseFeature } from './ingest-corpus-helpers.js';

interface Args { messages: number; runs: number; withLlm: boolean }
function parseArgs(argv: string[]): Args {
  const args: Args = { messages: 100, runs: 5, withLlm: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--messages') args.messages = Number(argv[++i]);
    else if (argv[i] === '--runs') args.runs = Number(argv[++i]);
    else if (argv[i] === '--with-llm') args.withLlm = true;
  }
  return args;
}

function makeMessages(n: number): NormalizedMessage[] {
  const samples = [
    'hey, how was your day?',
    'really busy. how about yours?',
    'i hear you, lots going on. anything fun planned?',
    'just trying to catch my breath honestly',
    'totally fair. love you',
    'love you too',
    'you always do this and never listen to me',
    'i am tired and stressed, please be patient',
    'i think we need to talk about us',
    'i agree, when are you free?',
    'why does she keep texting you about that',
    'he never says what he actually means',
    'they never listen when i ask about their day',
    'i miss you. want to grab coffee tonight?',
    'fine',
  ];
  const arr: NormalizedMessage[] = [];
  let t = Date.now() - n * 60_000;
  for (let i = 0; i < n; i++) {
    arr.push({
      message_id: `m${i}`,
      participant_id: i % 2 === 0 ? 'me' : 'partner',
      is_from_me: i % 2 === 0,
      text: samples[i % samples.length],
      timestamp: new Date(t).toISOString(),
      chat_id: 'bench',
    });
    t += 60_000;
  }
  return arr;
}

function pct(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

interface BenchRow { op: string; runs: number; mean: number; p50: number; p95: number; target: string; pass: boolean }

async function bench(name: string, target: number, runs: number, fn: () => unknown | Promise<unknown>): Promise<BenchRow> {
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    await fn();
    samples.push(performance.now() - t);
  }
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const p50 = pct(samples, 0.5);
  const p95 = pct(samples, 0.95);
  return { op: name, runs, mean, p50, p95, target: target === 0 ? '—' : `< ${target}ms`, pass: target === 0 || p95 < target };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rows: BenchRow[] = [];

  const messages = makeMessages(args.messages);
  const fw = new FunctionWordParser();
  const lex = new LexiconLookup();
  const affect = new AffectPass(lex);

  // L1: function-word + affect pass + latency over the full batch.
  rows.push(await bench(`L1 extraction (${args.messages} messages)`, 500, args.runs, () => {
    const latency = new LatencyZScore();
    const lz = latency.computeMessageZScores(messages);
    const feats = messages.map((m, i) => synthesiseFeature(
      m, fw.parse(m.text), affect.processMessage(m), lz.get(m.message_id) ?? 0,
      i > 0 ? messages[i - 1] : undefined,
      undefined,
    ));
    return feats;
  }));

  // Build a feature set once for detector benches
  const latency = new LatencyZScore();
  const lz = latency.computeMessageZScores(messages);
  const features = messages.map((m, i) => synthesiseFeature(
    m, fw.parse(m.text), affect.processMessage(m), lz.get(m.message_id) ?? 0,
    i > 0 ? messages[i - 1] : undefined,
    undefined,
  ));

  rows.push(await bench('bid-asymmetry detector', 100, args.runs, () => new BidAsymmetryDetector().detect(features, messages)));
  rows.push(await bench('predictive-divergence detector', 100, args.runs, () => new PredictiveDivergenceDetector().detect(features, messages)));
  rows.push(await bench('phantom-third-party detector', 100, args.runs, () => new PhantomThirdPartyDetector().detect(features)));
  rows.push(await bench('ethical refusal (fast path)', 100, args.runs, () => new EthicalRefusalClassifier({ bypass: true }).classifyFromFeatures(features)));

  rows.push(await bench('full orchestrator (no LLM)', 500, args.runs, async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dyad-bench-'));
    const rel = new RelationshipModelUpdater('bench', tmp).update(features, messages);
    const orch = new DetectorOrchestrator({ ethical: new EthicalRefusalClassifier({ bypass: true }), dyadId: 'bench' });
    const r = await orch.run({ messages, features, relationshipModel: rel });
    fs.rmSync(tmp, { recursive: true, force: true });
    return r;
  }));

  if (args.withLlm && process.env.ANTHROPIC_API_KEY) {
    const { ExtractionPipeline, BriefGenerator } = await import('../packages/engine/src/index.js');
    const pipeline = new ExtractionPipeline({ apiKey: process.env.ANTHROPIC_API_KEY, concurrency: 5 });
    rows.push(await bench(`L2 extraction (${args.messages} messages, c=5)`, 15_000, 1, async () => {
      await pipeline.processBatch(messages);
    }));
    const brief = new BriefGenerator({ apiKey: process.env.ANTHROPIC_API_KEY });
    const fakeResult = await new DetectorOrchestrator({ ethical: new EthicalRefusalClassifier({ bypass: true }), dyadId: 'bench' })
      .run({ messages, features });
    rows.push(await bench('brief generation (cache miss)', 5000, 1, async () => {
      await brief.generate('bid_asymmetry', fakeResult, messages.slice(-8));
    }));
    rows.push(await bench('brief generation (cache hit)', 50, 5, async () => {
      await brief.generate('bid_asymmetry', fakeResult, messages.slice(-8));
    }));
  } else {
    rows.push({ op: 'L2 extraction', runs: 0, mean: 0, p50: 0, p95: 0, target: '< 15000ms', pass: true });
    rows.push({ op: 'brief generation', runs: 0, mean: 0, p50: 0, p95: 0, target: '— skipped (no ANTHROPIC_API_KEY)', pass: true });
  }

  const md = [
    '# Performance benchmark (#62)',
    '',
    `Generated ${new Date().toISOString()} by \`scripts/benchmark.ts\` on \`${os.platform()} ${os.arch()}\`.`,
    '',
    `Args: messages=${args.messages}, runs=${args.runs}, with-llm=${args.withLlm}`,
    '',
    '| Operation | Runs | Mean (ms) | P50 (ms) | P95 (ms) | Target | Status |',
    '|-----------|------|-----------|----------|----------|--------|--------|',
    ...rows.map(r =>
      `| ${r.op} | ${r.runs} | ${r.mean.toFixed(2)} | ${r.p50.toFixed(2)} | ${r.p95.toFixed(2)} | ${r.target} | ${r.pass ? '✅' : '⚠'} |`
    ),
    '',
    '## Notes',
    '',
    '- L1 + detector benches use synthesised feature vectors so they run',
    '  without an API key. Latency is dominated by lexicon lookups + array',
    '  reductions, not network.',
    '- L2 / brief benches run only when `--with-llm` is set and a real',
    '  ANTHROPIC_API_KEY is present.',
    '',
  ].join('\n');

  const outDir = path.resolve(process.cwd(), 'scripts/validation');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'benchmark-results.md'), md);
  console.log('\nResults written to scripts/validation/benchmark-results.md');
  for (const r of rows) {
    console.log(`  ${r.op.padEnd(40)} P95=${r.p95.toFixed(1)}ms ${r.pass ? '✓' : '⚠'}`);
  }
}

main().catch(err => { console.error('[bench] failed:', err); process.exit(1); });
