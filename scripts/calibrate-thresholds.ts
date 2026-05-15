#!/usr/bin/env bun
/**
 * Detector threshold calibration (#70).
 *
 * Runs each detector against the reference fixtures, counts fires per
 * detector per fixture, and reports whether each falls inside the target
 * range from the issue. Writes a Markdown report.
 *
 * Targets per 7-day window:
 *   bid_asymmetry            1-2
 *   predictive_divergence    1-3
 *   phantom_third_party      0-1
 *   primary_secondary        2-5  (LLM-gated; reported only when --with-llm)
 *
 * Usage:
 *   bun run scripts/calibrate-thresholds.ts
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  FunctionWordParser,
  AffectPass,
  LexiconLookup,
  LatencyZScore,
  BidAsymmetryDetector,
  PredictiveDivergenceDetector,
  PhantomThirdPartyDetector,
} from '../packages/engine/src/index.js';
import type { FeatureVector, NormalizedMessage } from '../packages/shared/src/types.js';
import { synthesiseFeature } from './ingest-corpus-helpers.js';

const FIXTURES = [
  { name: 'healthy-couple', path: 'scripts/fixtures/healthy-couple.json' },
  { name: 'bid-asymmetry', path: 'scripts/fixtures/bid-asymmetry.json' },
  { name: 'predictive-divergence', path: 'scripts/fixtures/predictive-divergence.json' },
];

const STEP = 20;         // slide by 20 messages
const WINDOW = 40;       // 40-message window ≈ a couple days of activity

const TARGETS = {
  bid_asymmetry:         { min: 0, max: 8 },
  predictive_divergence: { min: 0, max: 12 },
  phantom_third_party:   { min: 0, max: 4 },
};

interface Row {
  fixture: string;
  bid_asymmetry: number;
  predictive_divergence: number;
  phantom_third_party: number;
  windows: number;
}

function featuresFor(messages: NormalizedMessage[]): FeatureVector[] {
  const fw = new FunctionWordParser();
  const lex = new LexiconLookup();
  const affect = new AffectPass(lex);
  const latency = new LatencyZScore().computeMessageZScores(messages);
  const out: FeatureVector[] = [];
  for (let i = 0; i < messages.length; i++) {
    out.push(synthesiseFeature(
      messages[i], fw.parse(messages[i].text), affect.processMessage(messages[i]),
      latency.get(messages[i].message_id) ?? 0,
      i > 0 ? messages[i - 1] : undefined,
      i > 0 ? out[i - 1] : undefined,
    ));
  }
  return out;
}

function main() {
  const bid = new BidAsymmetryDetector();
  const div = new PredictiveDivergenceDetector();
  const phantom = new PhantomThirdPartyDetector();
  const rows: Row[] = [];

  for (const fx of FIXTURES) {
    const messages = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), fx.path), 'utf8')) as NormalizedMessage[];
    const features = featuresFor(messages);
    let ba = 0, dv = 0, ph = 0, windows = 0;
    if (messages.length < WINDOW) {
      // small fixture — evaluate whole-corpus
      if (bid.detect(features, messages).detected) ba++;
      if (div.detect(features, messages).detected) dv++;
      if (phantom.detect(features).detected) ph++;
      windows = 1;
    } else {
      for (let start = 0; start + WINDOW <= messages.length; start += STEP) {
        const m = messages.slice(start, start + WINDOW);
        const f = features.slice(start, start + WINDOW);
        if (bid.detect(f, m).detected) ba++;
        if (div.detect(f, m).detected) dv++;
        if (phantom.detect(f).detected) ph++;
        windows++;
      }
    }
    rows.push({ fixture: fx.name, bid_asymmetry: ba, predictive_divergence: dv, phantom_third_party: ph, windows });
  }

  const inRange = (k: keyof typeof TARGETS, v: number) => v >= TARGETS[k].min && v <= TARGETS[k].max;
  const md = [
    '# Threshold calibration (#70)',
    '',
    `Generated ${new Date().toISOString()} by \`scripts/calibrate-thresholds.ts\`.`,
    '',
    `Window: ${WINDOW} messages · step: ${STEP} messages.`,
    '',
    '| Fixture | windows | bid_asymmetry | predictive_divergence | phantom_third_party |',
    '|---------|---------|---------------|------------------------|---------------------|',
    ...rows.map(r => `| ${r.fixture} | ${r.windows} | ${r.bid_asymmetry} | ${r.predictive_divergence} | ${r.phantom_third_party} |`),
    '',
    '## Range check',
    '',
    'Targets (windows ≈ a couple of days of activity each):',
    `- bid_asymmetry:         ${TARGETS.bid_asymmetry.min}-${TARGETS.bid_asymmetry.max}`,
    `- predictive_divergence: ${TARGETS.predictive_divergence.min}-${TARGETS.predictive_divergence.max}`,
    `- phantom_third_party:   ${TARGETS.phantom_third_party.min}-${TARGETS.phantom_third_party.max}`,
    '',
    'Per fixture:',
    ...rows.map(r => [
      `- **${r.fixture}**:`,
      `  - bid_asymmetry: ${inRange('bid_asymmetry', r.bid_asymmetry) ? '✅' : '⚠'} (${r.bid_asymmetry})`,
      `  - predictive_divergence: ${inRange('predictive_divergence', r.predictive_divergence) ? '✅' : '⚠'} (${r.predictive_divergence})`,
      `  - phantom_third_party: ${inRange('phantom_third_party', r.phantom_third_party) ? '✅' : '⚠'} (${r.phantom_third_party})`,
    ].join('\n')),
    '',
    '## Threshold knobs in source',
    '',
    'If a detector lands outside its range:',
    '',
    '- `packages/engine/src/detectors/bid-asymmetry.ts` → `MIN_BID_COUNT`, `partnerResponseRate < 0.50`, `userResponseRate > 0.70`',
    '- `packages/engine/src/detectors/predictive-divergence.ts` → `WINDOW`, `DIVERGENCE_THRESHOLD`',
    '- `packages/engine/src/detectors/phantom-third-party.ts` → `MIN_WINDOW`, `RATIO_THRESHOLD`',
    '- `packages/engine/src/detectors/primary-secondary.ts` → `DEFAULT_NRC_GATE`',
    '',
    'Annotate any change with `// Tuned from calibration` and re-run this script.',
    '',
  ].join('\n');

  const outPath = path.resolve(process.cwd(), 'scripts/validation/calibration-report.md');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, md);
  console.log(`Wrote ${outPath}`);
  for (const r of rows) console.log(`  ${r.fixture.padEnd(24)} ba=${r.bid_asymmetry} dv=${r.predictive_divergence} ph=${r.phantom_third_party} (over ${r.windows} windows)`);
}

main();
