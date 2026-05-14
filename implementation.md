# DYAD — Implementation Plan

This document is the engineering specification for building DYAD. It is ordered by build dependency: each phase produces artifacts consumed by the next. Engineers start here, not at the DDD.

---

## Phase 0 — Repo scaffold and shared types (Hour 0)

Everything depends on the shared type system. Do this first, freeze it at Hour 1.

### 0.1 Monorepo setup

```bash
mkdir -p apps/mac apps/phone packages/engine packages/ingestion packages/lexicons packages/prompts packages/shared corpora/team corpora/public
```

**`package.json` (root)**
```json
{
  "name": "dyad",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev:mac": "bun run --cwd apps/mac dev",
    "dev:phone": "bun run --cwd apps/phone start",
    "engine:test": "bun test packages/engine"
  }
}
```

Run `bun install` once to link workspaces.

### 0.2 Shared type definitions

**File to create: `packages/shared/src/types.ts`**

```typescript
// === Message schema ===
export interface RawMessage {
  rowid: number;
  text: string;
  handle_id: string;        // phone/email — hashed before leaving device
  date: number;             // Apple epoch (seconds since 2001-01-01)
  is_from_me: boolean;
  chat_id: string;
}

export interface NormalizedMessage {
  message_id: string;       // SHA-256(rowid + chat_id)
  participant_id: string;   // SHA-256(handle_id).slice(0, 16)
  is_from_me: boolean;
  text: string;             // PII-redacted
  timestamp: string;        // ISO 8601
  chat_id: string;
}

// === Feature vector (output of L2) ===
export interface FeatureVector {
  message_id: string;
  // Function-word layer (Pennebaker)
  fw_i: number;             // first-person singular rate
  fw_we: number;            // first-person plural rate
  fw_you: number;           // second-person rate
  fw_abs: number;           // absolutist language rate
  fw_tent: number;          // tentative language rate
  fw_cog: number;           // cognitive process word rate
  // Affect layer (NRC + AFINN)
  nrc_joy: number;
  nrc_trust: number;
  nrc_fear: number;
  nrc_surprise: number;
  nrc_sadness: number;
  nrc_disgust: number;
  nrc_anger: number;
  nrc_anticipation: number;
  nrc_positive: number;
  nrc_negative: number;
  afinn_valence: number;    // continuous -5 to +5
  intensifier_rate: number;
  // LLM extraction layer
  bid_classification: BidClassification;
  response_classification: ResponseClassification;
  horseman_markers: HorsemanMarkers;
  validation_markers: ValidationMarkers;
  primary_emotion: EmotionLabel;
  secondary_emotion_inference: SecondaryEmotionInference | null;
  action_id_level: 'low' | 'high';
  higgins_family: 'dejection' | 'agitation' | 'neutral' | null;
  topic_tags: string[];
  latency_z_score: number;
  clinical_flag: ClinicalFlag | null;
}

export interface BidClassification {
  is_bid: boolean;
  bid_type: 'observation' | 'question' | 'share' | 'request' | null;
  confidence: number;
}

export interface ResponseClassification {
  is_response_to_bid: boolean;
  quality: 'engaged' | 'perfunctory' | 'missed' | 'hostile' | null;
  confidence: number;
}

export interface HorsemanMarkers {
  criticism: boolean;
  contempt: boolean;
  defensiveness: boolean;
  stonewalling: boolean;
}

export interface ValidationMarkers {
  acknowledges: boolean;
  paraphrases: boolean;
  asks_to_understand: boolean;
}

export interface EmotionLabel {
  label: 'joy' | 'trust' | 'fear' | 'surprise' | 'sadness' | 'disgust' | 'anger' | 'anticipation';
  intensity: 'low' | 'med' | 'high';
  confidence: number;
}

export interface SecondaryEmotionInference {
  surface: string;
  underneath: 'hurt' | 'fear' | 'shame' | 'loneliness';
  confidence: number;
}

export interface ClinicalFlag {
  category: 'abuse' | 'suicidality' | 'severe_depression';
  confidence: number;
}

// === State objects (L3, persisted in GBrain) ===
export interface SelfModel {
  user_id: string;
  attachment_indicators: AttachmentIndicators;
  horseman_profile: Record<keyof HorsemanMarkers, number>;  // rolling rate
  bid_responsiveness_baseline: number;
  action_id_asymmetry: number;           // Vallacher-Wegner signature
  recurring_templates: RelationalTemplate[];
  updated_at: string;
}

export interface PartnerModel {
  dyad_id: string;
  partner_id: string;
  communication_fingerprint: CommunicationFingerprint;
  attachment_inference: AttachmentIndicators;
  external_context_bundle: ExternalContext[];
  trigger_profile: TriggerProfile[];
  bid_signature: BidSignature;
  updated_at: string;
}

export interface RelationshipModel {
  dyad_id: string;
  ppr_bidirectional: { user_to_partner: number; partner_to_user: number };
  five_to_one_ratio: number;
  bid_response_rate: { user_response_rate: number; partner_response_rate: number };
  repair_labor_index: number;            // >1 = user doing more repair labor
  mirroring_index: number;              // linguistic synchrony, 0-1
  open_loops: OpenLoop[];
  rupture_repair_ledger: RuptureRepairEvent[];
  updated_at: string;
}

export interface AttachmentIndicators {
  secure: number;
  anxious: number;
  avoidant: number;
  disorganized: number;
  confidence: number;
}

export interface RuptureRepairEvent {
  event_id: string;
  type: 'rupture' | 'repair';
  timestamp: string;
  status: 'open' | 'closed' | 'window_expired';
  source_message_ids: string[];
  confidence: number;
}

export interface OpenLoop {
  loop_id: string;
  description: string;
  opened_at: string;
  source_message_ids: string[];
}

// === Detector outputs (L4) ===
export interface BidAsymmetryResult {
  user_response_rate: number;
  partner_response_rate: number;
  gap: number;
  gottman_threshold_stable: 0.86;
  gottman_threshold_failing: 0.33;
  sample_size: number;
  confidence: number;
}

export interface PrimarySecondaryResult {
  surface_emotion: string;
  underlying_emotion: 'hurt' | 'fear' | 'shame' | 'loneliness';
  source_message_ids: string[];
  reframe: string;
  citations: string[];
  confidence: number;
}

export interface PredictiveDivergenceResult {
  user_intent_summary: string;
  partner_perception_summary: string;
  cosine_distance: number;
  divergent_phrases: { user_phrase: string; partner_phrase: string }[];
}

export interface PhantomThirdPartyResult {
  current_reaction_fingerprint: Record<string, number>;
  matched_historical_relationship: string;
  matched_message_ids: string[];
  confidence: number;
  pattern_description: string;
}

export interface EthicalRefusalResult {
  should_refuse: boolean;
  category: 'abuse' | 'suicidality' | 'severe_depression' | null;
  referral_resources: string[];
  confidence: number;
}

// === GBrain page types ===
export type DyadPageKind = 'dyad_self_model' | 'dyad_partner_model' | 'dyad_relationship_model' | 'dyad_detector_result';
```

**File to create: `packages/shared/src/schemas.ts`** — Zod schemas wrapping all types above. One schema per interface, exported with `parse()`.

---

## Phase 1 — L1 Ingestion (Hour 1)

### 1.1 iMessage reader

**File to create: `packages/ingestion/src/chat-db-reader.ts`**

```typescript
import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

const CHAT_DB = path.join(os.homedir(), 'Library', 'Messages', 'chat.db');
const APPLE_EPOCH_OFFSET = 978307200; // seconds between Unix and Apple epoch

export class ChatDbReader {
  private db: Database.Database;
  private lastRowid: number;

  constructor(checkpointRowid: number = 0) {
    this.db = new Database(CHAT_DB, { readonly: true, fileMustExist: true });
    this.lastRowid = checkpointRowid;
  }

  fetchNewMessages(): RawMessage[] {
    const rows = this.db.prepare(`
      SELECT
        m.ROWID          AS rowid,
        m.text,
        h.id             AS handle_id,
        m.date / 1000000000 + ${APPLE_EPOCH_OFFSET} AS date_unix,
        m.is_from_me,
        c.chat_identifier AS chat_id
      FROM message m
      LEFT JOIN handle h ON m.handle_id = h.ROWID
      LEFT JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
      LEFT JOIN chat c ON c.ROWID = cmj.chat_id
      WHERE m.ROWID > ? AND m.text IS NOT NULL AND m.text != ''
      ORDER BY m.ROWID ASC
      LIMIT 500
    `).all(this.lastRowid) as any[];

    if (rows.length > 0) {
      this.lastRowid = rows[rows.length - 1].rowid;
    }
    return rows;
  }

  getCheckpoint(): number {
    return this.lastRowid;
  }

  close(): void {
    this.db.close();
  }
}
```

### 1.2 Message normalizer

**File to create: `packages/ingestion/src/normalizer.ts`**

```typescript
import { createHash } from 'crypto';

export class MessageNormalizer {
  normalize(raw: RawMessage): NormalizedMessage {
    return {
      message_id: createHash('sha256')
        .update(`${raw.rowid}:${raw.chat_id}`)
        .digest('hex')
        .slice(0, 32),
      participant_id: createHash('sha256')
        .update(raw.handle_id ?? 'unknown')
        .digest('hex')
        .slice(0, 16),
      is_from_me: raw.is_from_me,
      text: this.redactPII(raw.text),
      timestamp: new Date(raw.date * 1000).toISOString(),
      chat_id: createHash('sha256').update(raw.chat_id).digest('hex').slice(0, 16),
    };
  }

  // Full PII redactor is in packages/engine/src/pii-redactor.ts
  // This is the inline fast-path version for ingestion
  private redactPII(text: string): string {
    return text
      .replace(/\+?1?\s*\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, '[PHONE]')
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
      .replace(/\b\d{5}(?:-\d{4})?\b/g, '[ZIP]');
  }
}
```

### 1.3 File watcher / daemon loop

**File to create: `packages/ingestion/src/watcher.ts`**

```typescript
import chokidar from 'chokidar';
import path from 'path';
import os from 'os';

const CHAT_DB = path.join(os.homedir(), 'Library', 'Messages', 'chat.db');

export class ChatDbWatcher {
  private watcher: chokidar.FSWatcher | null = null;

  start(onNewMessages: (messages: NormalizedMessage[]) => Promise<void>): void {
    const reader = new ChatDbReader(this.loadCheckpoint());
    const normalizer = new MessageNormalizer();

    const poll = async () => {
      const raw = reader.fetchNewMessages();
      if (raw.length > 0) {
        const normalized = raw.map(m => normalizer.normalize(m));
        await onNewMessages(normalized);
        this.saveCheckpoint(reader.getCheckpoint());
      }
    };

    // Poll immediately on first message, then watch for file changes
    this.watcher = chokidar.watch(CHAT_DB, { usePolling: false, awaitWriteFinish: true });
    this.watcher.on('change', poll);

    // Also poll on 30s interval as fallback (chokidar may miss some writes)
    setInterval(poll, 30_000);
    poll(); // initial poll
  }

  stop(): void {
    this.watcher?.close();
  }

  private loadCheckpoint(): number {
    // Load from GAgent's ingestion_checkpoints table via IPC or local file
    // MVP: read from .dyad-checkpoint file
    try {
      return parseInt(require('fs').readFileSync('.dyad-checkpoint', 'utf8')) || 0;
    } catch {
      return 0;
    }
  }

  private saveCheckpoint(rowid: number): void {
    require('fs').writeFileSync('.dyad-checkpoint', String(rowid));
  }
}
```

---

## Phase 2 — L2 Signal Extraction (Hours 1–3)

### 2.1 Lexicon setup

**File to create: `packages/lexicons/src/loader.ts`**

Download and commit as JSON before Hour 0:
- NRC Emotion Lexicon: https://saifmohammad.com/WebPages/NRC-Emotion-Lexicon.htm
- AFINN-111: https://github.com/fnielsen/afinn

```typescript
import nrc from '../data/nrc.json';      // { word: { joy: 0|1, trust: 0|1, ... } }
import afinn from '../data/afinn.json';  // { word: -5..5 }

export class LexiconLookup {
  getNRC(word: string): NRCEntry | null {
    return (nrc as any)[word.toLowerCase()] ?? null;
  }
  getAFINN(word: string): number {
    return (afinn as any)[word.toLowerCase()] ?? 0;
  }
}
```

### 2.2 Function-word parser (Pennebaker categories)

**File to create: `packages/engine/src/extraction/function-word-parser.ts`**

```typescript
import winkNLP from 'wink-nlp';
import model from 'wink-eng-lite-web-model';

const PENNEBAKER: Record<string, string[]> = {
  FW_I: ['i', 'me', 'my', 'mine', "i'm", "i've", "i'll", "i'd"],
  FW_WE: ['we', 'us', 'our', 'ours', "we're", "we've", "we'll"],
  FW_YOU: ['you', 'your', 'yours', "you're", "you've", "you'll"],
  FW_ABS: ['always', 'never', 'everything', 'nothing', 'everyone', 'nobody', 'completely', 'totally'],
  FW_TENT: ['maybe', 'perhaps', 'sort of', 'kind of', 'possibly', 'might', 'probably'],
  FW_COG: ['think', 'know', 'understand', 'realize', 'because', 'reason', 'cause', 'since'],
};

const nlp = winkNLP(model);

export function parseFunctionWords(text: string): Record<string, number> {
  const tokens = nlp.readDoc(text).tokens().out();
  const total = Math.max(tokens.length, 1);
  const result: Record<string, number> = {};

  for (const [key, words] of Object.entries(PENNEBAKER)) {
    const count = tokens.filter(t => words.includes(t.toLowerCase())).length;
    result[key.toLowerCase()] = count / total;
  }
  return result;
}
```

### 2.3 Lexicon-based affect pass

**File to create: `packages/engine/src/extraction/affect-pass.ts`**

```typescript
import { LexiconLookup } from '../../lexicons/src/loader';

const INTENSIFIERS = ['very', 'really', 'totally', 'completely', 'absolutely', 'extremely', 'so'];

export function runAffectPass(text: string, tokens: string[]): Partial<FeatureVector> {
  const lexicon = new LexiconLookup();
  const total = Math.max(tokens.length, 1);

  const nrcAccum = { joy: 0, trust: 0, fear: 0, surprise: 0, sadness: 0, disgust: 0, anger: 0, anticipation: 0, positive: 0, negative: 0 };
  let afinnSum = 0;
  let intensifierCount = 0;

  for (const token of tokens) {
    const nrc = lexicon.getNRC(token);
    if (nrc) {
      for (const [k, v] of Object.entries(nrc)) {
        (nrcAccum as any)[k] += v;
      }
    }
    afinnSum += lexicon.getAFINN(token);
    if (INTENSIFIERS.includes(token.toLowerCase())) intensifierCount++;
  }

  return {
    nrc_joy: nrcAccum.joy / total,
    nrc_trust: nrcAccum.trust / total,
    nrc_fear: nrcAccum.fear / total,
    nrc_surprise: nrcAccum.surprise / total,
    nrc_sadness: nrcAccum.sadness / total,
    nrc_disgust: nrcAccum.disgust / total,
    nrc_anger: nrcAccum.anger / total,
    nrc_anticipation: nrcAccum.anticipation / total,
    nrc_positive: nrcAccum.positive / total,
    nrc_negative: nrcAccum.negative / total,
    afinn_valence: afinnSum / total,
    intensifier_rate: intensifierCount / total,
  };
}
```

### 2.4 LLM structured-extraction pass

**File to create: `packages/engine/src/extraction/llm-extractor.ts`**

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const EXTRACTION_SCHEMA = {
  bid_classification: { is_bid: 'bool', bid_type: 'str|null', confidence: 'float' },
  response_classification: { is_response_to_bid: 'bool', quality: 'str|null', confidence: 'float' },
  horseman_markers: ['criticism', 'contempt', 'defensiveness', 'stonewalling'],
  validation_markers: { acknowledges: 'bool', paraphrases: 'bool', asks_to_understand: 'bool' },
  primary_emotion: { label: 'str', intensity: 'low|med|high', confidence: 'float' },
  secondary_emotion_inference: { surface: 'str', underneath: 'str|null', confidence: 'float' },
  action_identification_level: 'low|high',
  higgins_classification: 'dejection|agitation|neutral|null',
  topic_tags: ['str'],
  latency_relative_to_baseline: { z_score: 'float', flag: 'slow|fast|normal' },
  clinical_flag: { category: 'str|null', confidence: 'float' },
};

export async function runLLMExtraction(
  message: NormalizedMessage,
  context: NormalizedMessage[], // last 20 messages
  dyadLatencyBaseline: number   // median response latency in ms
): Promise<LLMExtractionResult> {
  const prompt = buildExtractionPrompt(message, context, dyadLatencyBaseline);

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',  // fast, cheap for extraction
    max_tokens: 1024,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type');

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in LLM extraction response');

  return JSON.parse(jsonMatch[0]) as LLMExtractionResult;
}
```

**File to create: `packages/prompts/extraction-system.txt`**

Write the system prompt here with:
- Gottman bid taxonomy definitions
- Four horsemen as Gottman defined them
- Plutchik wheel for primary emotions
- Johnson primary/secondary distinction
- Instruction to output the exact JSON schema above
- Instruction to include confidence on every claim

### 2.5 Extraction pipeline (combine all three passes)

**File to create: `packages/engine/src/extraction/pipeline.ts`**

```typescript
export class ExtractionPipeline {
  async extract(
    message: NormalizedMessage,
    context: NormalizedMessage[],
    dyadBaseline: number
  ): Promise<FeatureVector> {
    const tokens = tokenize(message.text);

    // Run deterministic passes in parallel (microseconds each)
    const [fw, affect] = await Promise.all([
      parseFunctionWords(message.text),
      runAffectPass(message.text, tokens),
    ]);

    // LLM pass runs after (needs the full context)
    const llm = await runLLMExtraction(message, context, dyadBaseline);

    return {
      message_id: message.message_id,
      ...fw,
      ...affect,
      ...llm,
    };
  }
}
```

---

## Phase 3 — L3 State Estimation (Hours 4–5)

### 3.1 Self-Model updater

**File to create: `packages/engine/src/state/self-model.ts`**

Updates the `SelfModel` object in GBrain after each new feature vector from the user's messages.

```typescript
export class SelfModelUpdater {
  async update(
    userId: string,
    features: FeatureVector,
    gbrainClient: GBrainClient
  ): Promise<SelfModel> {
    const current = await gbrainClient.read({ page_kind: 'dyad_self_model', tags: [userId] });
    const model: SelfModel = current ?? createEmptySelfModel(userId);

    // Update horseman profile (rolling 30-day rate)
    model.horseman_profile.criticism = rollingRate(
      model.horseman_profile.criticism, features.horseman_markers.criticism
    );
    // ... same for contempt, defensiveness, stonewalling

    // Update bid responsiveness baseline
    if (features.response_classification.is_response_to_bid) {
      model.bid_responsiveness_baseline = rollingRate(
        model.bid_responsiveness_baseline,
        features.response_classification.quality === 'engaged' ? 1 : 0
      );
    }

    model.updated_at = new Date().toISOString();
    await gbrainClient.write({ content: JSON.stringify(model), page_kind: 'dyad_self_model', tags: [userId] });
    return model;
  }
}
```

### 3.2 Partner-Model updater

**File to create: `packages/engine/src/state/partner-model.ts`**

Updates the `PartnerModel` from the partner's message feature vectors plus The Hog enrichment.

Key logic:
- `bid_signature`: accumulate bid types, compute distribution
- `trigger_profile`: track messages with high emotional intensity, cluster by topic_tags
- `communication_fingerprint`: rolling average of message length, response latency distribution
- Enrich with The Hog every 6 hours: query `/hog/context?entity={partner_id}`, fold into `external_context_bundle`

### 3.3 Relationship-Model updater

**File to create: `packages/engine/src/state/relationship-model.ts`**

Updates the `RelationshipModel` — the third and most important object.

Critical metrics to update:
- `bid_response_rate`: scan last N messages for bid/response pairs, compute per-direction rate
- `five_to_one_ratio`: count positive vs negative interactions (NRC valence + horseman markers) over conflict-context windows
- `mirroring_index`: compute linguistic synchrony (cosine similarity of function-word profiles between the two participants over rolling 7-day window)
- `rupture_repair_ledger`: when horseman cluster detected (3+ markers in 10 messages), open a rupture; when validation markers spike after a rupture, attempt to close it
- `repair_labor_index`: who initiates repair bids after rupture events (FW_WE elevation, ask_to_understand markers)

---

## Phase 4 — L4 Detectors (Hours 5–7)

Each detector is a pure function: `(state: L3State, features: FeatureVector[]) => DetectorOutput`. They are stateless themselves; all state lives in GBrain.

### 4.1 Bid Response Asymmetry detector

**File to create: `packages/engine/src/detectors/bid-asymmetry.ts`**

```typescript
export function detectBidAsymmetry(
  messages: NormalizedMessage[],
  features: FeatureVector[]
): BidAsymmetryResult {
  // For each bid (is_bid === true), look forward N=5 messages for a response
  // Classify response quality: engaged / perfunctory / missed / hostile
  // Compute per-direction engaged-response rate
  // Require minimum 20 bids per direction for confidence > 0.7

  const userBids = features.filter(f => f.bid_classification.is_bid && getParticipant(f) === 'user');
  const partnerBids = features.filter(f => f.bid_classification.is_bid && getParticipant(f) === 'partner');

  const userResponseRate = computeResponseRate(userBids, features);
  const partnerResponseRate = computeResponseRate(partnerBids, features);

  return {
    user_response_rate: userResponseRate,
    partner_response_rate: partnerResponseRate,
    gap: Math.abs(userResponseRate - partnerResponseRate),
    gottman_threshold_stable: 0.86,
    gottman_threshold_failing: 0.33,
    sample_size: Math.min(userBids.length, partnerBids.length),
    confidence: Math.min(userBids.length, partnerBids.length) >= 20 ? 0.85 : 0.5,
  };
}
```

### 4.2 Primary/Secondary Emotion Separation

**File to create: `packages/engine/src/detectors/primary-secondary.ts`**

```typescript
export async function detectPrimarySecondary(
  conflictMessages: NormalizedMessage[],
  conflictFeatures: FeatureVector[]
): Promise<PrimarySecondaryResult[]> {
  // Filter to messages tagged as anger/contempt/disgust family
  const candidates = conflictFeatures.filter(f =>
    ['anger', 'disgust'].includes(f.primary_emotion.label) && f.primary_emotion.confidence > 0.6
  );

  const results: PrimarySecondaryResult[] = [];
  for (const candidate of candidates) {
    // Get 5 messages before and after for context
    const context = getContextWindow(candidate, conflictMessages, 5);

    // Secondary LLM pass with Johnson-EFT-grounded prompt
    const result = await runSecondaryEmotionPrompt(candidate, context);
    if (result.confidence >= 0.70) {
      results.push(result);
    }
  }
  return results;
}
```

**File to create: `packages/prompts/secondary-emotion.txt`**

Prompt instructs Claude Sonnet to:
1. Read the message and surrounding context
2. Identify whether the expressed emotion (anger, contempt) is protecting against a vulnerable emotion
3. Name the vulnerable emotion (hurt / fear / shame / loneliness — Johnson's primary emotion categories)
4. Cite the specific linguistic markers that indicate the inference
5. Generate a non-blaming reframe that addresses the primary emotion
6. Output structured JSON with confidence

### 4.3 Predictive Divergence

**File to create: `packages/engine/src/detectors/predictive-divergence.ts`**

```typescript
export async function detectPredictiveDivergence(
  draftMessage: string,
  recentUserMessages: NormalizedMessage[],
  partnerModel: PartnerModel
): Promise<PredictiveDivergenceResult> {
  // Run two parallel LLM calls
  const [intentSummary, perceptionSummary] = await Promise.all([
    summarizeIntent(draftMessage, recentUserMessages),
    summarizePerception(draftMessage, partnerModel),
  ]);

  // Embed both summaries and compute cosine distance
  const distance = await computeEmbeddingDistance(intentSummary, perceptionSummary);

  // Differential summarization: find specific phrases causing divergence
  const divergentPhrases = await findDivergentPhrases(
    draftMessage, intentSummary, perceptionSummary, partnerModel
  );

  return {
    user_intent_summary: intentSummary,
    partner_perception_summary: perceptionSummary,
    cosine_distance: distance,
    divergent_phrases: divergentPhrases,
  };
}
```

Use `claude-sonnet-4-6` for both passes (higher-stakes, user-facing output).

### 4.4 Phantom Third Party

**File to create: `packages/engine/src/detectors/phantom-third-party.ts`**

```typescript
export async function detectPhantomThirdParty(
  reactionFeatures: FeatureVector,
  currentRelationshipFeatures: FeatureVector[],
  historicalCrossRelationshipFeatures: FeatureVector[]  // from other modeled relationships
): Promise<PhantomThirdPartyResult | null> {
  // Step 1: Is this reaction disproportionate?
  const baseline = computeRollingBaseline(currentRelationshipFeatures, reactionFeatures.topic_tags);
  const zScore = (reactionFeatures.afinn_valence - baseline.mean) / baseline.stddev;
  if (Math.abs(zScore) < 1.5) return null;  // not disproportionate

  // Step 2: Compute behavioral fingerprint of this reaction
  const fingerprint = extractFingerprint(reactionFeatures);

  // Step 3: Search historical corpus for similar fingerprints
  const matches = findFingerprintClusters(fingerprint, historicalCrossRelationshipFeatures);

  if (matches.length === 0) return null;

  const topMatch = matches[0];
  if (topMatch.confidence < 0.80) return null;  // hard threshold

  return {
    current_reaction_fingerprint: fingerprint,
    matched_historical_relationship: topMatch.relationship_id,
    matched_message_ids: topMatch.message_ids,
    confidence: topMatch.confidence,
    pattern_description: await generatePatternDescription(fingerprint, topMatch),
  };
}
```

**Confidence threshold is hard: 0.80. Never lower. Suppressed silently if not met.**

### 4.5 Ethical Refusal Classifier

**File to create: `packages/engine/src/detectors/ethical-refusal.ts`**

```typescript
const REFUSAL_RESOURCES = {
  abuse: ['National DV Hotline: 1-800-799-7233', 'thehotline.org'],
  suicidality: ['988 Suicide & Crisis Lifeline: call or text 988', 'crisis text line: text HOME to 741741'],
  severe_depression: ['NAMI Helpline: 1-800-950-6264', 'samhsa.gov/find-help'],
};

export async function runEthicalRefusal(
  features: FeatureVector[],
  threshold = { abuse: 0.75, suicidality: 0.70, severe_depression: 0.75 }
): Promise<EthicalRefusalResult> {
  // Check rolling clinical_flag signals
  const recentFlags = features.slice(-20).map(f => f.clinical_flag).filter(Boolean);

  for (const [category, thresh] of Object.entries(threshold)) {
    const categoryFlags = recentFlags.filter(f => f?.category === category);
    const avgConfidence = categoryFlags.reduce((s, f) => s + (f?.confidence ?? 0), 0) / Math.max(categoryFlags.length, 1);

    if (categoryFlags.length >= 2 && avgConfidence >= thresh) {
      return {
        should_refuse: true,
        category: category as any,
        referral_resources: REFUSAL_RESOURCES[category as keyof typeof REFUSAL_RESOURCES],
        confidence: avgConfidence,
      };
    }
  }

  return { should_refuse: false, category: null, referral_resources: [], confidence: 0 };
}
```

**This classifier runs before every downstream analytical call. No bypass path.**

---

## Phase 5 — L5 Intervention Engine (Hours 5–6, parallel with L4)

### 5.1 Brief generator

**File to create: `packages/engine/src/intervention/brief-generator.ts`**

Generates a pre-conversation prep card on demand. Inputs: `RelationshipModel`, `PartnerModel`, `jo` context (calendar event, recent shared photos). Output: `Brief` with unresolved open loops, partner's likely state, two opening-message drafts with predicted responses.

```typescript
export async function generateBrief(
  relationshipModel: RelationshipModel,
  partnerModel: PartnerModel,
  joContext: JoContext
): Promise<Brief> {
  // Extract open loops from relationship model
  const openLoops = relationshipModel.open_loops.slice(0, 3);

  // Partner's likely current state from recent external context
  const partnerState = inferPartnerState(partnerModel);

  // Generate two draft openers, each with predicted response
  const drafts = await Promise.all([
    generateDraft('direct', openLoops, partnerState, partnerModel),
    generateDraft('soft', openLoops, partnerState, partnerModel),
  ]);

  return { open_loops: openLoops, partner_likely_state: partnerState, draft_openers: drafts };
}
```

### 5.2 Reframe generator

Called by the Primary/Secondary detector output. Takes a `PrimarySecondaryResult` and generates a non-blaming reframe phrased in the user's voice (not the system's voice). Uses `claude-sonnet-4-6` with a Walton-Wilson wise-intervention system prompt.

---

## Phase 6 — L6 Surface (Hours 1–8, parallel track)

### 6.1 Tauri app scaffold

```bash
bun create tauri-app apps/mac --template react-ts
cd apps/mac && bun add @dyad/shared visx framer-motion zustand
```

### 6.2 The Map view

**File to create: `apps/mac/src/views/Map.tsx`**

The Map is the primary visual hook. Build this first.

```
Vertical axis:    emotional valence (AFINN score, -5 to +5)
Horizontal axis:  time
Line color:       dominant NRC emotion (mapped to color per Plutchik wheel)
Rupture markers:  red dots at horseman cluster events (3+ horsemen in 10 messages)
Repair markers:   green dots at repair events
Topic regions:    shaded horizontal bands when topic_tags cluster
Animation:        Framer Motion spring on first load, 8 seconds for 14-month arc
```

Use Visx `AreaClosed` for the emotional temperature surface, `Marker` components for rupture/repair events. All data from GBrain `RelationshipModel.rupture_repair_ledger` + `FeatureVector[]` AFINN values.

**Cache strategy:** Map renders from cached GBrain state. Never block render on LLM call. Pre-warm on app open in background.

### 6.3 The Atlas view

**File to create: `apps/mac/src/views/Atlas.tsx`**

Message-level view. Each message renders as a row with:
- Left column: timestamp + participant indicator
- Main: message text with primary emotion color underline
- Right: emotion tag chip (label + intensity as chip size) + secondary emotion label if present
- Long-press: citation popover showing source literature

Map emotion labels to colors:
```typescript
const EMOTION_COLORS = {
  joy: '#FFD700',       anger: '#DC2626',
  trust: '#3B82F6',     anticipation: '#F97316',
  fear: '#7C3AED',      surprise: '#EC4899',
  sadness: '#64748B',   disgust: '#65A30D',
};
```

### 6.4 Predictive Divergence view

**File to create: `apps/mac/src/views/PredictiveDivergence.tsx`**

The only view with a live LLM call. User types a draft message. On commit (Enter or button):
1. POST draft to engine → runs `detectPredictiveDivergence()`
2. Render two summary boxes side-by-side (user intent / partner perception)
3. Render divergence distance as a visual gap (horizontal bar, scaled by `cosine_distance`)
4. Highlight divergent phrases in both boxes

4-second timeout. Cached fallback renders the most recent prior result with a "using prior message for comparison" label.

### 6.5 The Mirror view (opt-in)

**File to create: `apps/mac/src/views/Mirror.tsx`**

Gate behind explicit opt-in. Renders `SelfModel`:
- Attachment indicator bars (secure/anxious/avoidant/disorganized) — labeled as "tendencies under pressure", not diagnostic labels
- Horseman profile: four bars showing the user's own production rate vs Gottman baselines
- Action-identification asymmetry score: labeled as "how you tend to explain your own vs others' behavior"
- Bid responsiveness baseline: your rate vs the Gottman threshold

Every insight includes a "why this matters" tooltip citing the specific paper.

---

## Phase 7 — GStack integration wiring (Hour 3, parallel with everything)

### 7.1 GStack pipeline definition

**File to create: `packages/engine/src/pipeline.ts`**

Register the L2→L3→L4 pipeline in GStack. Each stage is a typed service:

```typescript
export const DYAD_PIPELINE = {
  name: 'dyad-message-pipeline',
  stages: [
    { name: 'extract', handler: extractionPipeline.extract },
    { name: 'update-self-model', handler: selfModelUpdater.update },
    { name: 'update-partner-model', handler: partnerModelUpdater.update },
    { name: 'update-relationship-model', handler: relationshipModelUpdater.update },
    { name: 'run-detectors', handler: detectorOrchestrator.run },
    { name: 'check-refusal', handler: ethicalRefusal.run },
  ],
};
```

The detector orchestrator runs all four detectors in parallel via `Promise.all()` (same pattern as `DetectorPool` in gorchestrator). Ethical refusal runs last on the aggregated feature window.

### 7.2 GBrain schema

Three page kinds, one per state object:

```typescript
// In GBrain, write with these page_kind values:
await gbrainClient.write({ content: JSON.stringify(selfModel), page_kind: 'dyad_self_model', tags: [userId] });
await gbrainClient.write({ content: JSON.stringify(partnerModel), page_kind: 'dyad_partner_model', tags: [dyadId, partnerId] });
await gbrainClient.write({ content: JSON.stringify(relModel), page_kind: 'dyad_relationship_model', tags: [dyadId] });

// Detector results:
await gbrainClient.write({ content: JSON.stringify(detectorOutput), page_kind: 'dyad_detector_result', tags: [dyadId, detectorName] });
```

**Never write raw message text to GBrain. Only feature vectors and state objects.**

### 7.3 The Hog integration

```typescript
// packages/engine/src/enrichment/thehog.ts
export class HogEnricher {
  private cache = new Map<string, { data: ExternalContext[]; fetched_at: number }>();
  private CACHE_TTL_MS = 6 * 60 * 60 * 1000;  // 6 hours

  async enrich(partnerId: string): Promise<ExternalContext[]> {
    const cached = this.cache.get(partnerId);
    if (cached && Date.now() - cached.fetched_at < this.CACHE_TTL_MS) {
      return cached.data;
    }
    const data = await fetch(`${HOG_BASE_URL}/context?entity=${partnerId}`, {
      headers: { Authorization: `Bearer ${process.env.THE_HOG_API_KEY}` },
    }).then(r => r.json());
    this.cache.set(partnerId, { data, fetched_at: Date.now() });
    return data;
  }
}
```

---

## Phase 8 — Demo corpus and variance reduction (Hour 2, parallel)

### 8.1 Corpus ingestion script

**File to create: `corpora/ingest.ts`**

```typescript
// Takes a chat.db export (SQLite) and produces a normalized corpus JSONL
// Usage: bun run corpora/ingest.ts --db ~/Library/Messages/chat.db --contact "+1XXXXXXXXXX" --out corpora/team/alice.jsonl
```

Pre-ingest 5–8 team relationships with consent. Validate each produces reliable outputs for the three guaranteed detectors (bid asymmetry, Map, Atlas).

### 8.2 Public figure corpus

**File to create: `corpora/public/jobs-sculley.ts`**

Ingest from published emails, interviews, and biographical material (Jobs/Sculley Apple arc). Structure as the same `NormalizedMessage[]` format — manually constructed from published sources, no private data.

### 8.3 Fixture corpus for engine tests

**File to create: `packages/engine/test/fixtures/fixture-corpus.jsonl`**

20–30 manually crafted messages that reliably trigger each detector. Used by `bun run engine:test`. Each fixture annotated with expected outputs for assertion.

---

## Phase 9 — Integration checkpoints

### Checkpoint 1 (Hour 4)
- [ ] `bun run engine:test` passes on fixture corpus
- [ ] Ingestion reads real chat.db and produces normalized messages
- [ ] L2 extraction runs on sample corpus (200 messages in < 30s)
- [ ] Mac app loads and renders Map with mock data
- [ ] Atlas view renders per-message emotion tags with mock data

### Checkpoint 2 (Hour 8)
- [ ] Full L2→L3→L4 pipeline runs on a real team relationship
- [ ] Bid asymmetry detector fires with correct values
- [ ] Primary/Secondary detector fires on at least one conflict in corpus
- [ ] Predictive Divergence live view works end-to-end
- [ ] Ethical refusal classifier tested on pre-seeded synthetic conversation
- [ ] GBrain state objects populated and readable
- [ ] iOS/Mac app renders from real state (not mock)

### Checkpoint 3 / Cut hour (Hour 11)
- [ ] Full demo end-to-end on 3 different relationships, timed at < 7 minutes
- [ ] Phantom Third Party: fires reliably on 2/3 relationships or cut from demo
- [ ] All LLM demo-path calls pre-cached
- [ ] Backup device warm-built, same state
- [ ] Ethical refusal demo fires on pre-seeded corpus

---

## Phase 10 — Post-hackathon hardening

These are not in the 12-hour build. They are the first 30-day work items.

| Item | Priority | Owner |
|------|----------|-------|
| Swift macOS daemon (replace Python/TS prototype) | High | Stream A |
| Consent flow for mutual mode (two-party opt-in) | High | Stream B |
| Discord and WhatsApp ingestion adapters | Medium | Stream A |
| Cross-relationship pattern transfer detector | Medium | Stream A |
| Four horsemen as surfaced metric (currently internal) | Medium | Stream B |
| Attachment-style classification UI (with clinical framing) | Medium | Stream B |
| Expert annotation validation study (precision/recall) | High | Clinical lead |
| Encryption at rest for GBrain state objects | Critical | Stream A |
| Audit trail for all data access | Critical | Stream A |
| Clinical research lead hire | Critical | Team lead |
| TestFlight distribution setup | Low | Stream B |

---

## Appendix: LLM cost management

| Call | Model | Frequency | Est. cost/msg |
|------|-------|-----------|---------------|
| L2 structured extraction | claude-haiku-4-5 | Every message | ~$0.0001 |
| Secondary emotion (L4) | claude-sonnet-4-6 | ~10% of messages | ~$0.001 |
| Predictive Divergence (live) | claude-sonnet-4-6 | On demand | ~$0.005 |
| Brief generation (L5) | claude-sonnet-4-6 | On demand | ~$0.01 |
| Phantom Third Party (L4) | claude-sonnet-4-6 | ~1% of messages | ~$0.005 |

Cache aggressively: Map and Atlas render from GBrain cache. Pre-warm demo-path outputs before stepping on stage. Budget: $20–80 for hackathon build.

---

## Appendix: Environment setup

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install Tauri prerequisites (macOS)
xcode-select --install
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Grant Full Disk Access to Terminal
# System Settings → Privacy & Security → Full Disk Access → add Terminal

# Verify chat.db access
sqlite3 ~/Library/Messages/chat.db "SELECT COUNT(*) FROM message;"

# Set up .env
cp .env.example .env
# Fill in: ANTHROPIC_API_KEY, GSTACK_API_KEY, GBRAIN_API_KEY, THE_HOG_API_KEY, JO_API_KEY
# Always set: DYAD_PII_REDACTION=true

# Download lexicons
bun run packages/lexicons/scripts/download.ts
```
