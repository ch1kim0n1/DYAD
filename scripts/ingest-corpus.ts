#!/usr/bin/env bun
/**
 * Corpus ingestion — load a fixture conversation and run it end-to-end
 * through the DYAD engine: L1 + L2 extraction → state updaters → detectors.
 *
 * Usage:
 *   bun run scripts/ingest-corpus.ts --fixture scripts/fixtures/sample-conversation.json
 *
 * When ANTHROPIC_API_KEY is set, full L2 (Claude Haiku) extraction runs.
 * Otherwise the script synthesises plausible LLM extraction values from
 * lexical signals so the rest of the pipeline can still be exercised.
 *
 * Output: scripts/output/<fixture-basename>-results.json
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
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

function parseArgs(argv: string[]): { fixture: string } {
  const fixtureIdx = argv.indexOf('--fixture');
  if (fixtureIdx === -1 || !argv[fixtureIdx + 1]) {
    console.error('Usage: bun run scripts/ingest-corpus.ts --fixture <path>');
    process.exit(1);
  }
  return { fixture: argv[fixtureIdx + 1] };
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

/** Synthesise a feature vector from lexicons when no API key is available. */
function synthesiseFeature(
  message: NormalizedMessage,
  fw: ReturnType<FunctionWordParser['parse']>,
  affect: ReturnType<AffectPass['processMessage']>,
  latencyZ: number,
  prevMessage?: NormalizedMessage,
  prevFeature?: FeatureVector
): FeatureVector {
  const text = message.text.toLowerCase();
  const isQuestion = /[?]\s*$/.test(message.text);
  const isShare = /\b(i (feel|think|want|need|just)|today i|just wanted)/i.test(text);
  const isRequest = /\b(can you|could you|please|would you mind)/i.test(text);
  const bidType = isQuestion ? 'question' : isShare ? 'share' : isRequest ? 'request' : null;

  const horseman = {
    criticism: /\byou (always|never)\b|what is wrong with you/i.test(text),
    contempt: /\bridiculous\b|\bpathetic\b|whatever|eye[- ]?roll/i.test(text),
    defensiveness: /\bit('?s| is) not my fault\b|\byou'?re overreacting\b/i.test(text),
    stonewalling: /\b(fine|whatever|nothing|i('?m| am) done)\b/i.test(text) && message.text.length < 40,
  };
  const validation = {
    acknowledges: /\bi hear you\b|\bthat makes sense\b|\bi understand\b/i.test(text),
    paraphrases: /\bso (you'?re saying|you mean)\b/i.test(text),
    asks_to_understand: isQuestion && /\bhow do you feel\b|\bwhy\b|\bwhat is going on\b/i.test(text),
  };

  const dominantEmotion = pickEmotion(affect);
  const lowerTextLen = message.text.trim().length;
  const stonewalled = horseman.stonewalling;
  const explicitValidation =
    validation.acknowledges || validation.paraphrases || validation.asks_to_understand;

  // If the previous message (from the other participant) was a bid, this
  // message is implicitly a response. Quality is inferred from valence and
  // length, not just from explicit validation markers — a warm short
  // reply still counts as engaged.
  const followsBid =
    prevMessage !== undefined &&
    prevFeature !== undefined &&
    prevMessage.is_from_me !== message.is_from_me &&
    prevFeature.bid_classification.is_bid;
  let responseClassification: FeatureVector['response_classification'];
  if (stonewalled) {
    responseClassification = { is_response_to_bid: true, quality: 'missed', confidence: 0.6 };
  } else if (explicitValidation) {
    responseClassification = { is_response_to_bid: true, quality: 'engaged', confidence: 0.7 };
  } else if (followsBid) {
    const warm = affect.afinn_valence >= 0 && !horseman.criticism && !horseman.contempt;
    const tooBrief = message.text.trim().length < 8;
    const quality: 'engaged' | 'perfunctory' | 'missed' =
      tooBrief && affect.afinn_valence <= 0
        ? 'missed'
        : warm && message.text.trim().length >= 15
        ? 'engaged'
        : 'perfunctory';
    responseClassification = { is_response_to_bid: true, quality, confidence: 0.55 };
  } else {
    responseClassification = { is_response_to_bid: false, quality: null, confidence: 0 };
  }

  return {
    message_id: message.message_id,
    fw_i: fw.fw_i,
    fw_we: fw.fw_we,
    fw_you: fw.fw_you,
    fw_abs: fw.fw_abs,
    fw_tent: fw.fw_tent,
    fw_cog: fw.fw_cog,
    fw_third: fw.fw_third,
    nrc_joy: affect.nrc_joy,
    nrc_trust: affect.nrc_trust,
    nrc_fear: affect.nrc_fear,
    nrc_surprise: affect.nrc_surprise,
    nrc_sadness: affect.nrc_sadness,
    nrc_disgust: affect.nrc_disgust,
    nrc_anger: affect.nrc_anger,
    nrc_anticipation: affect.nrc_anticipation,
    nrc_positive: affect.nrc_positive,
    nrc_negative: affect.nrc_negative,
    afinn_valence: affect.afinn_valence,
    intensifier_rate: affect.intensifier_rate,
    bid_classification: {
      is_bid: bidType !== null,
      bid_type: bidType,
      confidence: bidType !== null ? 0.6 : 0,
    },
    response_classification: responseClassification,
    horseman_markers: horseman,
    validation_markers: validation,
    primary_emotion: {
      label: dominantEmotion,
      intensity: lowerTextLen > 120 ? 'high' : lowerTextLen > 30 ? 'med' : 'low',
      confidence: 0.55,
    },
    secondary_emotion_inference: null,
    action_id_level: /\b(plan|future|relationship|love|values|why)\b/.test(text) ? 'high' : 'low',
    higgins_family: affect.afinn_valence < -1 ? 'dejection' : affect.afinn_valence > 1 ? 'neutral' : 'neutral',
    topic_tags: extractTags(text),
    latency_z_score: latencyZ,
    clinical_flag: null,
  };
}

function pickEmotion(a: ReturnType<AffectPass['processMessage']>) {
  const entries: [FeatureVector['primary_emotion']['label'], number][] = [
    ['joy', a.nrc_joy],
    ['trust', a.nrc_trust],
    ['fear', a.nrc_fear],
    ['surprise', a.nrc_surprise],
    ['sadness', a.nrc_sadness],
    ['disgust', a.nrc_disgust],
    ['anger', a.nrc_anger],
    ['anticipation', a.nrc_anticipation],
  ];
  entries.sort((x, y) => y[1] - x[1]);
  return entries[0][0];
}

function extractTags(text: string): string[] {
  const tags = new Set<string>();
  if (/\b(work|job|boss|deadline|meeting)\b/i.test(text)) tags.add('work');
  if (/\b(money|rent|bills?|budget|pay)\b/i.test(text)) tags.add('finances');
  if (/\b(mom|dad|family|parents?|sister|brother)\b/i.test(text)) tags.add('family');
  if (/\b(love|us|we|partner|relationship)\b/i.test(text)) tags.add('relationship');
  if (/\b(sex|intimacy)\b/i.test(text)) tags.add('intimacy');
  if (/\b(plan|future|move|kids?|marry|marriage)\b/i.test(text)) tags.add('future');
  return [...tags];
}

async function main(): Promise<void> {
  const { fixture } = parseArgs(process.argv.slice(2));
  const fixturePath = path.resolve(process.cwd(), fixture);
  console.log(`[ingest] loading fixture: ${fixturePath}`);

  const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as FixtureMessage[];
  const messages = normalise(raw);
  console.log(`[ingest] ${messages.length} messages loaded`);

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

  // State updaters use a tmpdir so the script never pollutes ~/.dyad
  const tmpDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'dyad-ingest-'));

  const selfUpdater = new SelfModelUpdater('demo-user', tmpDir);
  const selfModel = selfUpdater.update(features, messages);

  const partnerUpdater = new PartnerModelUpdater('demo-dyad', 'demo-partner', tmpDir);
  const partnerModel = partnerUpdater.update(features, messages);

  const relUpdater = new RelationshipModelUpdater('demo-dyad', tmpDir);
  const relationshipModel = relUpdater.update(features, messages);

  // Detectors — orchestrator with a bypassed ethical gate (script doesn't call out)
  const ethical = new EthicalRefusalClassifier({ bypass: true });
  const orchestrator = new DetectorOrchestrator({ ethical, dyadId: 'demo-dyad' });
  const result = await orchestrator.run({ messages, features, relationshipModel });

  // Also expose detector instances directly for completeness
  const bid = new BidAsymmetryDetector().detect(features, messages);
  const divergence = new PredictiveDivergenceDetector().detect(features, messages);
  const phantom = new PhantomThirdPartyDetector().detect(features);

  const outDir = path.resolve(process.cwd(), 'scripts/output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${path.basename(fixture, '.json')}-results.json`);
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        fixture,
        message_count: messages.length,
        models: { self: selfModel, partner: partnerModel, relationship: relationshipModel },
        detectors: { bid_asymmetry: bid, predictive_divergence: divergence, phantom_third_party: phantom },
        orchestrator: result,
      },
      null,
      2
    )
  );

  console.log(`[ingest] wrote ${outPath}`);
  console.log(`[ingest] summary:`);
  console.log(`   gottman_status        = ${relationshipModel.gottman_status}`);
  console.log(`   bid_asymmetry         = detected=${bid.detected} severity=${bid.severity}`);
  console.log(`   predictive_divergence = detected=${divergence.detected}`);
  console.log(`   phantom_third_party   = detected=${phantom.detected}`);

  fs.rmSync(tmpDir, { recursive: true, force: true });
}

main().catch(err => {
  console.error('[ingest] failed:', err);
  process.exit(1);
});
