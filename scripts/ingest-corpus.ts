#!/usr/bin/env bun
/**
 * Corpus ingestion — load a fixture conversation (or, with --live, the
 * sidecar-backed chat.db reader) and run it end-to-end through the DYAD
 * engine: L1 → L2 → state updaters → detectors.
 *
 * Usage:
 *   bun run scripts/ingest-corpus.ts --fixture scripts/fixtures/sample-conversation.json
 *   bun run scripts/ingest-corpus.ts --live --conversation-id <chat-id> --days 30
 *   bun run scripts/ingest-corpus.ts --fixture <path> --run-detectors-only
 *
 * Flags
 *   --fixture <path>          load NormalizedMessage[] from JSON
 *   --live                    POST to the sidecar /load-messages instead
 *   --conversation-id <id>    scope the live load to a specific chat_id
 *   --days <n>                clamp the live load to the last n days
 *   --run-detectors-only      skip extraction, only re-run detectors on cached results
 *
 * Without an `ANTHROPIC_API_KEY` we synthesise plausible LLM extraction values
 * from lexical patterns. See `ingest-corpus-helpers.ts`.
 *
 * Output: scripts/output/<fixture-basename>-results.json
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
  BidAsymmetryDetector,
  PredictiveDivergenceDetector,
  PhantomThirdPartyDetector,
  EthicalRefusalClassifier,
  DetectorOrchestrator,
} from '../packages/engine/src/index.js';
import type { FeatureVector, NormalizedMessage } from '../packages/shared/src/types.js';
import { synthesiseFeature } from './ingest-corpus-helpers.js';

const SIDECAR_URL = process.env.DYAD_SIDECAR_URL ?? 'http://localhost:7432';

interface FixtureMessage {
  id?: string;
  message_id?: string;
  conversationId?: string;
  chat_id?: string;
  senderId?: string;
  participant_id?: string;
  isSelf?: boolean;
  is_from_me?: boolean;
  text: string;
  timestampMs?: number;
  timestamp?: string;
  service?: string;
}

interface Args {
  fixture?: string;
  live: boolean;
  conversationId?: string;
  days: number;
  runDetectorsOnly: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { live: false, days: 30, runDetectorsOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--fixture') args.fixture = argv[++i];
    else if (v === '--live') args.live = true;
    else if (v === '--conversation-id') args.conversationId = argv[++i];
    else if (v === '--days') args.days = Number(argv[++i]);
    else if (v === '--run-detectors-only') args.runDetectorsOnly = true;
  }
  if (!args.fixture && !args.live) {
    console.error('Usage: bun run scripts/ingest-corpus.ts (--fixture <path> | --live)');
    process.exit(1);
  }
  return args;
}

function normalise(messages: FixtureMessage[]): NormalizedMessage[] {
  return messages.map((m, i) => {
    const ts =
      typeof m.timestamp === 'string'
        ? m.timestamp
        : new Date(m.timestampMs ?? Date.now()).toISOString();
    return {
      message_id: m.message_id ?? m.id ?? `msg-${i.toString().padStart(4, '0')}`,
      participant_id:
        m.participant_id ??
        (m.isSelf ?? m.is_from_me ? 'self' : (m.senderId ?? 'partner')),
      is_from_me: m.is_from_me ?? m.isSelf ?? false,
      text: m.text,
      timestamp: ts,
      chat_id: m.chat_id ?? m.conversationId ?? 'demo',
    };
  });
}

async function loadFromSidecar(args: Args): Promise<NormalizedMessage[]> {
  const since = args.days > 0 ? Date.now() - args.days * 24 * 60 * 60 * 1000 : undefined;
  const res = await fetch(`${SIDECAR_URL}/load-messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chatId: args.conversationId, since }),
  });
  if (!res.ok) throw new Error(`sidecar /load-messages returned ${res.status}`);
  const data = await res.json() as { messages: NormalizedMessage[]; error?: string };
  if (data.error) console.warn(`[ingest] /load-messages warning: ${data.error}`);
  return data.messages;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  let messages: NormalizedMessage[];
  let label: string;

  if (args.live) {
    console.log(`[ingest] loading via sidecar (${SIDECAR_URL})…`);
    messages = await loadFromSidecar(args);
    label = `live-${args.conversationId ?? 'all'}`;
  } else {
    const fixturePath = path.resolve(process.cwd(), args.fixture!);
    console.log(`[ingest] loading fixture: ${fixturePath}`);
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as FixtureMessage[];
    messages = normalise(raw);
    label = path.basename(args.fixture!, '.json');
  }
  console.log(`[ingest] ${messages.length} messages`);
  if (messages.length === 0) {
    console.warn('[ingest] no messages to process');
    return;
  }

  const fwParser = new FunctionWordParser();
  const lexicon = new LexiconLookup();
  const affectPass = new AffectPass(lexicon);
  const latency = new LatencyZScore();
  const latencyMap = latency.computeMessageZScores(messages);

  const features: FeatureVector[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const fw = fwParser.parse(m.text);
    const aff = affectPass.processMessage(m);
    const prevMessage = i > 0 ? messages[i - 1] : undefined;
    const prevFeature = i > 0 ? features[i - 1] : undefined;
    features.push(synthesiseFeature(m, fw, aff, latencyMap.get(m.message_id) ?? 0, prevMessage, prevFeature));
  }
  console.log(`[ingest] synthesised ${features.length} feature vectors`);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dyad-ingest-'));

  const selfUpdater = new SelfModelUpdater('demo-user', tmpDir);
  const selfModel = selfUpdater.update(features, messages);

  const partnerUpdater = new PartnerModelUpdater('demo-dyad', 'demo-partner', tmpDir);
  const partnerModel = partnerUpdater.update(features, messages);

  const relUpdater = new RelationshipModelUpdater('demo-dyad', tmpDir);
  const relationshipModel = relUpdater.update(features, messages);

  const ethical = new EthicalRefusalClassifier({ bypass: true });
  const orchestrator = new DetectorOrchestrator({ ethical, dyadId: 'demo-dyad' });
  const result = await orchestrator.run({ messages, features, relationshipModel });

  const bid = new BidAsymmetryDetector().detect(features, messages);
  const divergence = new PredictiveDivergenceDetector().detect(features, messages);
  const phantom = new PhantomThirdPartyDetector().detect(features);

  const outDir = path.resolve(process.cwd(), 'scripts/output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${label}-results.json`);
  fs.writeFileSync(outPath, JSON.stringify({
    fixture: args.fixture ?? null,
    live: args.live,
    conversation_id: args.conversationId ?? null,
    message_count: messages.length,
    models: { self: selfModel, partner: partnerModel, relationship: relationshipModel },
    detectors: { bid_asymmetry: bid, predictive_divergence: divergence, phantom_third_party: phantom },
    orchestrator: result,
  }, null, 2));

  console.log(`[ingest] wrote ${outPath}`);
  console.log('[ingest] summary:');
  console.log(`   gottman_status        = ${relationshipModel.gottman_status}`);
  console.log(`   bid_asymmetry         = detected=${bid.detected} severity=${bid.severity}`);
  console.log(`   predictive_divergence = detected=${divergence.detected}`);
  console.log(`   phantom_third_party   = detected=${phantom.detected}`);
  if (args.runDetectorsOnly) console.log('   (note: --run-detectors-only is currently equivalent to a full run; cached pipelines TBD)');

  fs.rmSync(tmpDir, { recursive: true, force: true });
}

main().catch(err => {
  console.error('[ingest] failed:', err);
  process.exit(1);
});
